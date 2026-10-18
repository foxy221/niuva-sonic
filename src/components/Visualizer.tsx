import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { getAnalyser } from "../design/analyser";
import { usePlayer } from "../state/player";

const BANDS = 48;
const MAX_RINGS = 14;
const RING_POINTS = 72;
const TAU = Math.PI * 2;

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

interface Ring {
  /** Abstand zum Cover-Rand. */
  r: number;
  speed: number;
  /** 0..1, wie kräftig der Schlag war; bestimmt Helligkeit und Verformung. */
  strength: number;
  tone: number;
  /** Abdruck des Spektrums im Moment des Schlags: formt den Ring. */
  shape: Float32Array;
  /** Drehung der Abbildung, damit nicht jeder Ring gleich liegt. */
  turn: number;
}

/** Liest die aktuelle Akzentfarbe als RGB. */
function readAccent(scratch: CanvasRenderingContext2D): number[] {
  const css = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff3d9a";
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = css;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgba = (c: number[], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const VIOLET_RGB = [138, 60, 255];
const AMBER_RGB = [255, 179, 71];
const WHITE = [255, 255, 255];

/**
 * Hintergrund des Vollbilds, zweilagig: dezenter Nebel in den Logo-Farben, der mit
 * den Frequenzbereichen anschwillt, und darüber weiche Ringe, die bei Bassschlägen
 * aus dem Cover nach außen laufen. Jeder Ring trägt das Spektrum seines Moments als
 * leichte Verformung mit sich. Der Nebel besteht aus Elementen, die nur `transform`
 * und `opacity` ändern (läuft auf der Grafikkarte), die Ringe sind dünne Linien und
 * damit billig zu zeichnen. Ohne Analyse (Android, Server ohne CORS) bleibt es bei
 * ruhigem Treiben.
 */
export default function Visualizer({ anchor }: { anchor: RefObject<HTMLElement | null> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!root || !canvas || !ctx) return;
    const scratch = document.createElement("canvas");
    scratch.width = scratch.height = 1;
    const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bands = new Float32Array(BANDS);
    const raw = new Float32Array(BANDS);
    const energy = new Float32Array(CLOUDS.length);
    const average = new Float32Array(CLOUDS.length).fill(0.3);
    const kick = new Float32Array(CLOUDS.length);
    const rings: Ring[] = [];
    const idle = { level: 0.2 };
    let width = 0;
    let height = 0;
    let coverX = 0;
    let coverY = 0;
    let coverR = 120;
    let accent = readAccent(scratchCtx);
    let tones: number[][] = [];
    let accentAt = 0;
    let measureAt = 0;
    let last = 0;
    let lastBeat = 0;
    let lastDrift = 0;
    let bassAvg = 0.3;
    let loudness = 0;
    let frame = 0;
    let analyserData: Uint8Array<ArrayBuffer> | null = null;
    let analyserNode: AnalyserNode | null = null;
    let edges: number[] = [];

    function updateTones() {
      tones = [accent, VIOLET_RGB, AMBER_RGB, mix(accent, VIOLET_RGB, 0.5)].map((c) => mix(c, WHITE, 0.35));
    }
    updateTones();

    function resize() {
      width = root!.clientWidth;
      height = root!.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
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
        coverR = box.width / 2;
      } else {
        coverX = width * 0.3;
        coverY = height * 0.5;
        coverR = Math.min(width, height) * 0.2;
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
      let sum = 0;
      for (let i = 0; i < BANDS; i++) sum += bands[i];
      loudness += (Math.min(1, sum / BANDS / 0.5) - loudness) * (1 - Math.exp(-dt / 250));
    }

    function spawnRing(strength: number, speed: number) {
      if (rings.length >= MAX_RINGS) rings.shift();
      rings.push({
        r: 0,
        speed,
        strength,
        tone: Math.random() < 0.45 ? 3 : Math.floor(Math.random() * 3),
        shape: Float32Array.from(bands),
        turn: Math.random(),
      });
    }

    /** Pegel am Umfangsanteil `u`: links und rechts gespiegelt, oben die Bässe, unten die Höhen. */
    const shapeAt = (shape: Float32Array, u: number) => {
      const mirrored = 1 - Math.abs((((u % 1) + 1) % 1) * 2 - 1);
      const f = mirrored * (BANDS - 1);
      const i = Math.floor(f);
      return shape[i] + (shape[Math.min(BANDS - 1, i + 1)] - shape[i]) * (f - i);
    };

    function drawRings(dt: number) {
      const dpr = canvas!.width / Math.max(1, width);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineJoin = "round";
      const reach = Math.max(width, height) * 0.62;
      const drive = 0.7 + loudness * 0.7;

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r += ring.speed * drive * dt;
        const travelled = ring.r / reach;
        if (travelled >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const fadeIn = Math.min(1, ring.r / 36);
        const alpha = ring.strength * fadeIn * Math.pow(1 - travelled, 1.2);
        const base = coverR * 1.04 + ring.r;
        // Die Verformung wächst mit der Entfernung ein Stück mit und bleibt dabei weich.
        const wobble = coverR * 0.32 * ring.strength * (0.5 + travelled * 0.9);
        const pts: [number, number][] = [];
        for (let k = 0; k < RING_POINTS; k++) {
          const u = k / RING_POINTS;
          const a = u * TAU - Math.PI / 2;
          const r = base + (shapeAt(ring.shape, u + ring.turn * 0.04) - 0.3) * wobble;
          pts.push([coverX + Math.cos(a) * r, coverY + Math.sin(a) * r]);
        }
        ctx!.beginPath();
        ctx!.moveTo((pts[0][0] + pts[RING_POINTS - 1][0]) / 2, (pts[0][1] + pts[RING_POINTS - 1][1]) / 2);
        for (let k = 0; k < RING_POINTS; k++) {
          const p = pts[k];
          const n = pts[(k + 1) % RING_POINTS];
          ctx!.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
        }
        ctx!.closePath();
        const color = tones[ring.tone];
        // Zwei Durchgänge: breit und blass als Schimmer, dünn und hell als eigentliche Linie.
        ctx!.strokeStyle = rgba(color, 1);
        ctx!.lineWidth = 12 + ring.strength * 8;
        ctx!.globalAlpha = alpha * 0.14;
        ctx!.stroke();
        ctx!.lineWidth = 4;
        ctx!.globalAlpha = alpha * 0.3;
        ctx!.stroke();
        ctx!.lineWidth = 1.6;
        ctx!.globalAlpha = Math.min(1, alpha * 0.95);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    function draw(t: number) {
      const dt = Math.min(50, last ? t - last : 16);
      last = t;
      const playing = usePlayer.getState().playing;
      if (t - accentAt > 500) {
        const next = readAccent(scratchCtx);
        if (next.some((v, i) => Math.abs(v - accent[i]) > 3)) {
          accent = next;
          updateTones();
        }
        accentAt = t;
      }
      measure(t);
      sample(t, dt, playing);
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

      if (!reduceMotion) {
        let bass = 0;
        for (let i = 0; i < 6; i++) bass += bands[i];
        bass /= 6;
        bassAvg += (bass - bassAvg) * (1 - Math.exp(-dt / 700));
        // Bassschlag: ein kräftiger Ring, bei starkem Schlag direkt ein zweiter hinterher.
        if (playing && bass > bassAvg * 1.14 + 0.02 && t - lastBeat > 170) {
          const strength = Math.min(1, ((bass - bassAvg) / Math.max(bassAvg, 0.1)) * 2.2 + 0.45);
          lastBeat = t;
          lastDrift = t;
          spawnRing(strength, 0.3 + strength * 0.16);
          if (strength > 0.8) spawnRing(strength * 0.6, 0.22);
        }
        // Zwischen den Schlägen läuft in ruhigen Passagen gelegentlich ein leiser Ring mit.
        if (playing && t - lastDrift > 900 - loudness * 450) {
          lastDrift = t;
          spawnRing(0.35 + loudness * 0.25, 0.2);
        }
        drawRings(dt);
        frame = requestAnimationFrame(draw);
      }
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
      <canvas ref={canvasRef} className="rings" />
    </div>
  );
}
