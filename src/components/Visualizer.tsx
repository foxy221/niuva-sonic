import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { getAnalyser } from "../design/analyser";
import { usePlayer } from "../state/player";

const BANDS = 48;
const MAX_STREAKS = 240;
const SPRITE_W = 160;
const SPRITE_H = 12;
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

interface Streak {
  angle: number;
  r: number;
  start: number;
  speed: number;
  length: number;
  thickness: number;
  tone: number;
  strength: number;
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

/** Ein weicher Streifen als fertiges Bild: Schweif schwach, Kopf hell, quer weich auslaufend. */
function makeStreak(color: number[]): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_W;
  sprite.height = SPRITE_H;
  const g = sprite.getContext("2d")!;
  const along = g.createLinearGradient(0, 0, SPRITE_W, 0);
  along.addColorStop(0, rgba(color, 0));
  along.addColorStop(0.55, rgba(mix(color, [255, 255, 255], 0.3), 0.55));
  along.addColorStop(0.9, rgba(mix(color, [255, 255, 255], 0.7), 1));
  along.addColorStop(1, rgba(color, 0));
  g.fillStyle = along;
  g.fillRect(0, 0, SPRITE_W, SPRITE_H);
  g.globalCompositeOperation = "destination-in";
  const across = g.createLinearGradient(0, 0, 0, SPRITE_H);
  across.addColorStop(0, "rgba(0,0,0,0)");
  across.addColorStop(0.5, "rgba(0,0,0,1)");
  across.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = across;
  g.fillRect(0, 0, SPRITE_W, SPRITE_H);
  return sprite;
}

/**
 * Hintergrund des Vollbilds, zweilagig: dezenter Nebel in den Logo-Farben, der mit
 * den Frequenzbereichen anschwillt, und darüber weiche Lichtstreifen, die im Takt
 * der Bässe aus dem Cover radial nach außen fliegen. Der Nebel besteht aus
 * Elementen, die nur `transform` und `opacity` ändern (läuft auf der Grafikkarte),
 * die Streifen sind dünn und damit billig zu zeichnen. Ohne Analyse (Android,
 * Server ohne CORS) bleibt es bei ruhigem Treiben.
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
    const streaks: Streak[] = [];
    const rings: { r: number; a: number }[] = [];
    const idle = { level: 0.2 };
    let width = 0;
    let height = 0;
    let coverX = 0;
    let coverY = 0;
    let coverR = 120;
    let accent = readAccent(scratchCtx);
    let sprites: HTMLCanvasElement[] = [];
    let accentAt = 0;
    let measureAt = 0;
    let last = 0;
    let lastBeat = 0;
    let bassAvg = 0.3;
    let spawnDebt = 0;
    let loudness = 0;
    let frame = 0;
    let analyserData: Uint8Array<ArrayBuffer> | null = null;
    let analyserNode: AnalyserNode | null = null;
    let edges: number[] = [];

    function updateSprites() {
      sprites = [accent, VIOLET_RGB, AMBER_RGB, mix(accent, VIOLET_RGB, 0.5)].map(makeStreak);
    }
    updateSprites();

    function resize() {
      width = root!.clientWidth;
      height = root!.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    function spawn(count: number, burst: boolean, strength: number) {
      for (let n = 0; n < count && streaks.length < MAX_STREAKS; n++) {
        const speed = (burst ? 0.6 : 0.35) + Math.random() * (burst ? 0.7 : 0.4);
        streaks.push({
          angle: Math.random() * TAU,
          r: coverR * (0.55 + Math.random() * 0.2),
          start: coverR * 0.55,
          speed,
          length: 110 + speed * 300 + Math.random() * 110,
          thickness: 3.5 + Math.random() * 3.5,
          tone: Math.random() < 0.5 ? 3 : Math.floor(Math.random() * 3),
          strength: Math.min(1, (burst ? 1.1 : 0.7) * strength),
        });
      }
    }

    function drawStreaks(dt: number) {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const dpr = canvas!.width / Math.max(1, width);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.globalCompositeOperation = "source-over";
      const reach = Math.max(width, height) * 0.7;
      const drive = 0.6 + loudness * 0.9;

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.r += s.speed * drive * dt;
        const travelled = (s.r - s.start) / reach;
        if (travelled >= 1) {
          streaks.splice(i, 1);
          continue;
        }
        const fadeIn = Math.min(1, (s.r - s.start) / 40);
        const alpha = s.strength * fadeIn * Math.pow(1 - travelled, 1.1);
        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);
        ctx!.globalAlpha = alpha;
        ctx!.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, dpr * (coverX + cos * s.r), dpr * (coverY + sin * s.r));
        ctx!.drawImage(sprites[s.tone], -s.length, -s.thickness / 2, s.length, s.thickness);
      }

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.lineWidth = 1.6;
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.r += dt * 0.32 * drive;
        ring.a *= Math.pow(0.9972, dt);
        if (ring.a < 0.02) {
          rings.splice(i, 1);
          continue;
        }
        ctx!.strokeStyle = rgba(accent, 1);
        ctx!.beginPath();
        ctx!.arc(coverX, coverY, coverR * 1.05 + ring.r, 0, TAU);
        ctx!.globalAlpha = ring.a * 0.25;
        ctx!.lineWidth = 9;
        ctx!.stroke();
        ctx!.globalAlpha = ring.a * 0.7;
        ctx!.lineWidth = 1.4;
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    function draw(t: number) {
      const dt = Math.min(50, last ? t - last : 16);
      last = t;
      const playing = usePlayer.getState().playing;
      if (t - accentAt > 500) {
        const next = readAccent(scratchCtx);
        if (next.some((v, i) => Math.abs(v - accent[i]) > 3)) {
          accent = next;
          updateSprites();
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
        // Bassschlag: kräftiger Stoß aus dem Cover, dazu ein weicher Ring.
        let bass = 0;
        for (let i = 0; i < 6; i++) bass += bands[i];
        bass /= 6;
        bassAvg += (bass - bassAvg) * (1 - Math.exp(-dt / 700));
        if (playing && bass > bassAvg * 1.14 + 0.02 && t - lastBeat > 150) {
          const strength = Math.min(1, (bass - bassAvg) / Math.max(bassAvg, 0.1) * 2.2 + 0.4);
          lastBeat = t;
          spawn(14 + Math.round(strength * 18), true, strength);
          if (strength > 0.55) rings.push({ r: 0, a: 0.6 * strength });
        }
        // Dazu ein gleichmäßiger Strom, der mit der Lautstärke dichter wird.
        spawnDebt += (playing ? 12 + loudness * 44 : 3) * (dt / 1000);
        const whole = Math.floor(spawnDebt);
        if (whole > 0) {
          spawn(whole, false, 0.6 + loudness * 0.4);
          spawnDebt -= whole;
        }
        drawStreaks(dt);
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
      <canvas ref={canvasRef} className="streaks" />
    </div>
  );
}
