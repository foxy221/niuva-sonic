import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { getAnalyser } from "../design/analyser";
import { usePlayer } from "../state/player";

const BANDS = 48;

interface Cloud {
  /** Welche Klangbänder die Wolke bewegen. */
  from: number;
  to: number;
  /** Mittelpunkt als Anteil der Fläche und Bahn, auf der sie treibt. */
  x: number;
  y: number;
  driftX: number;
  driftY: number;
  speed: number;
  phase: number;
  /** Durchmesser als Anteil der längeren Seite. */
  size: number;
  aspect: number;
  /** Drehung in Grad pro Sekunde. */
  spin: number;
  tone: string;
  /** Nur die Bass-Wolke hängt am Cover. */
  anchored?: boolean;
}

const ACCENT = "var(--accent)";
const VIOLET = "#8a3cff";
const AMBER = "#ffb347";
const BLEND = "color-mix(in srgb, var(--accent) 50%, #8a3cff)";

const CLOUDS: Cloud[] = [
  { from: 0, to: 3, x: 0.3, y: 0.5, driftX: 0.02, driftY: 0.03, speed: 0.00018, phase: 0, size: 0.62, aspect: 0.9, spin: 3, tone: ACCENT, anchored: true },
  { from: 3, to: 8, x: 0.45, y: 0.3, driftX: 0.12, driftY: 0.1, speed: 0.00023, phase: 1.3, size: 0.46, aspect: 0.55, spin: -6, tone: VIOLET },
  { from: 8, to: 14, x: 0.7, y: 0.68, driftX: 0.14, driftY: 0.1, speed: 0.00019, phase: 2.6, size: 0.5, aspect: 0.5, spin: 5, tone: AMBER },
  { from: 14, to: 22, x: 0.8, y: 0.3, driftX: 0.12, driftY: 0.12, speed: 0.00027, phase: 4.0, size: 0.42, aspect: 0.6, spin: -7, tone: BLEND },
  { from: 22, to: 32, x: 0.22, y: 0.78, driftX: 0.1, driftY: 0.08, speed: 0.00022, phase: 5.2, size: 0.4, aspect: 0.5, spin: 6, tone: VIOLET },
  { from: 32, to: 47, x: 0.9, y: 0.6, driftX: 0.08, driftY: 0.16, speed: 0.0003, phase: 3.3, size: 0.36, aspect: 0.55, spin: 8, tone: AMBER },
];

/**
 * Weicher Nebel hinter dem Vollbild: Wolken in den Logo-Farben treiben langsam
 * über die Fläche und schwellen mit ihrem Frequenzbereich an. Die tiefste Wolke
 * glüht hinter dem Cover im Takt der Bässe. Jede Wolke ist ein eigenes Element
 * mit CSS-Verlauf; bewegt werden nur `transform` und `opacity`, das übernimmt
 * die Grafikkarte ohne Neuzeichnen. Ohne Analyse (Android, Server ohne CORS)
 * treiben sie nur ruhig.
 */
export default function Visualizer({ anchor }: { anchor: RefObject<HTMLElement | null> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cloudRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bands = new Float32Array(BANDS);
    const raw = new Float32Array(BANDS);
    const energy = new Float32Array(CLOUDS.length);
    const average = new Float32Array(CLOUDS.length).fill(0.3);
    const kick = new Float32Array(CLOUDS.length);
    const idle = { level: 0.2 };
    let width = 0;
    let height = 0;
    let coverX = 0;
    let coverY = 0;
    let measureAt = 0;
    let last = 0;
    let frame = 0;
    let analyserData: Uint8Array<ArrayBuffer> | null = null;
    let analyserNode: AnalyserNode | null = null;
    let edges: number[] = [];

    function resize() {
      width = root!.clientWidth;
      height = root!.clientHeight;
      const unit = Math.max(width, height);
      CLOUDS.forEach((cloud, k) => {
        const el = cloudRefs.current[k];
        if (!el) return;
        const d = unit * cloud.size;
        el.style.width = `${d}px`;
        el.style.height = `${d}px`;
        el.style.marginLeft = `${-d / 2}px`;
        el.style.marginTop = `${-d / 2}px`;
      });
      measureAt = 0;
    }

    function measure(t: number) {
      if (t - measureAt < 500) return;
      measureAt = t;
      const box = anchor.current?.getBoundingClientRect();
      const origin = root!.getBoundingClientRect();
      if (box && box.width > 0) {
        coverX = box.left - origin.left + box.width / 2;
        coverY = box.top - origin.top + box.height / 2;
      } else {
        coverX = width * 0.3;
        coverY = height * 0.5;
      }
    }

    function sample(t: number, dt: number, playing: boolean) {
      analyserNode ??= getAnalyser();
      if (analyserNode && playing) {
        analyserData ??= new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(analyserData);
        if (!edges.length) {
          const top = Math.min(analyserData.length - 1, 380);
          edges = Array.from({ length: BANDS + 1 }, (_, i) => Math.round(2 * Math.pow(top / 2, i / BANDS)));
        }
        for (let i = 0; i < BANDS; i++) {
          let sum = 0;
          const from = edges[i];
          const to = Math.max(edges[i + 1], from + 1);
          for (let k = from; k < to; k++) sum += analyserData[k];
          raw[i] = (sum / (to - from) / 255) * (1 + (i / BANDS) * 0.6);
        }
      } else {
        idle.level += ((playing ? 0.24 : 0.1) - idle.level) * 0.03;
        for (let i = 0; i < BANDS; i++) raw[i] = Math.max(0, idle.level * (0.55 + 0.45 * Math.sin(t * 0.0009 + i * 0.4)));
      }
      const up = 1 - Math.exp(-dt / 28);
      const down = 1 - Math.exp(-dt / 150);
      for (let i = 0; i < BANDS; i++) bands[i] += (raw[i] - bands[i]) * (raw[i] > bands[i] ? up : down);
      CLOUDS.forEach((cloud, k) => {
        let sum = 0;
        for (let i = cloud.from; i <= cloud.to; i++) sum += bands[i];
        const value = sum / (cloud.to - cloud.from + 1);
        // Gegen den eigenen gleitenden Durchschnitt messen: Schläge leuchten auf, Lücken dunkeln ab.
        average[k] += (value - average[k]) * (1 - Math.exp(-dt / 1400));
        const delta = (value - average[k]) / Math.max(average[k], 0.1);
        const previous = energy[k];
        energy[k] = Math.max(0, Math.min(1, 0.35 + delta * 2.2));
        kick[k] = Math.min(1, Math.max(kick[k] * Math.exp(-dt / 170), Math.max(0, energy[k] - previous) * 5));
      });
    }

    function draw(t: number) {
      const dt = Math.min(50, last ? t - last : 16);
      last = t;
      measure(t);
      sample(t, dt, usePlayer.getState().playing);
      const unit = Math.max(width, height);

      CLOUDS.forEach((cloud, k) => {
        const el = cloudRefs.current[k];
        if (!el) return;
        const e = energy[k];
        const sx = Math.sin(t * cloud.speed + cloud.phase);
        const cy = Math.cos(t * cloud.speed * 0.8 + cloud.phase * 1.7);
        const x = cloud.anchored ? coverX + sx * unit * cloud.driftX : width * (cloud.x + sx * cloud.driftX);
        const y = cloud.anchored ? coverY + cy * unit * cloud.driftY : height * (cloud.y + cy * cloud.driftY);
        const scale = 0.45 + e * 0.7 + kick[k] * 0.3;
        const angle = (t / 1000) * cloud.spin + cloud.phase * 40;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg) scale(${scale.toFixed(3)}, ${(scale * cloud.aspect).toFixed(3)})`;
        el.style.opacity = Math.min(0.75, 0.03 + e * 0.38 + kick[k] * 0.3).toFixed(3);
      });
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    }

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(performance.now());
    });
    observer.observe(root);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [anchor]);

  return (
    <div ref={rootRef} className="full-viz" aria-hidden="true">
      {CLOUDS.map((cloud, k) => (
        <span key={k} ref={(el) => { cloudRefs.current[k] = el; }} className="cloud" style={{ "--tone": cloud.tone } as CSSProperties} />
      ))}
    </div>
  );
}
