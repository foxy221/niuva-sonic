import { useEffect, useRef } from "react";
import { getAnalyser } from "../design/analyser";
import { usePlayer } from "../state/player";

const BANDS = 56;
const LAYERS = 3;
const VIOLET = [138, 60, 255];
const AMBER = [255, 179, 71];

/** Liest die aktuelle Akzentfarbe als RGB, damit Verläufe mit Transparenz arbeiten können. */
function readAccent(scratch: CanvasRenderingContext2D): number[] {
  const css = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff3d9a";
  scratch.clearRect(0, 0, 1, 1);
  scratch.fillStyle = css;
  scratch.fillRect(0, 0, 1, 1);
  const [r, g, b] = scratch.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const rgba = (c: number[], a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/**
 * Klangbänder im Stil des Logos: drei fließende Bänder über die ganze Breite,
 * deren Höhe dem Spektrum folgt, dazu ein Glühen hinter dem Cover im Takt der Bässe.
 * Ohne Analyse (Android, Server ohne CORS) bewegen sie sich nur ruhig.
 */
export default function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scratch = document.createElement("canvas");
    scratch.width = scratch.height = 1;
    const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bands = new Float32Array(BANDS);
    const idle = { level: 0.25 };
    let width = 0;
    let height = 0;
    let accent = readAccent(scratchCtx);
    let accentAt = 0;
    let frame = 0;
    let analyserData: Uint8Array<ArrayBuffer> | null = null;
    let analyserNode: AnalyserNode | null = null;
    // Bin-Grenzen der Bänder, logarithmisch: tiefe Töne bekommen genauso viel Platz wie hohe.
    let edges: number[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sample(t: number, playing: boolean) {
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
          const tilt = 1 + (i / BANDS) * 0.9;
          const v = Math.min(1, (sum / (to - from) / 255) * tilt);
          bands[i] = v > bands[i] ? v : bands[i] * 0.9 + v * 0.1;
        }
      } else {
        // Ruhebewegung: langsames Atmen, bei Pause noch leiser.
        idle.level += ((playing ? 0.3 : 0.12) - idle.level) * 0.03;
        for (let i = 0; i < BANDS; i++) {
          const v = idle.level * (0.55 + 0.45 * Math.sin(t * 0.0011 + i * 0.32) * Math.sin(t * 0.0007 - i * 0.11));
          bands[i] += (Math.max(0, v) - bands[i]) * 0.08;
        }
      }
    }

    function ribbon(layer: number, t: number, gradient: CanvasGradient) {
      const baseY = height * (0.5 + (layer - 1) * 0.045);
      const reach = height * (0.2 + layer * 0.045);
      const shift = layer * 7;
      const top: [number, number][] = [];
      const bottom: [number, number][] = [];
      for (let i = 0; i < BANDS; i++) {
        const x = (i / (BANDS - 1)) * width;
        const taper = Math.pow(Math.sin(Math.PI * (i / (BANDS - 1))), 0.65);
        const level = (bands[(i + shift) % BANDS] + bands[(i + shift + 1) % BANDS]) / 2;
        const drift = Math.sin(t * 0.0006 * (1 + layer * 0.35) + i * 0.21 + layer * 2) * height * 0.012;
        const h = (level * reach + 2) * taper;
        top.push([x, baseY - h + drift]);
        bottom.push([x, baseY + h * (0.8 + layer * 0.1) + drift]);
      }
      const curve = (points: [number, number][], forward: boolean) => {
        const list = forward ? points : [...points].reverse();
        for (let i = 0; i < list.length - 1; i++) {
          const mx = (list[i][0] + list[i + 1][0]) / 2;
          const my = (list[i][1] + list[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(list[i][0], list[i][1], mx, my);
        }
        ctx!.lineTo(list[list.length - 1][0], list[list.length - 1][1]);
      };
      ctx!.beginPath();
      ctx!.moveTo(top[0][0], top[0][1]);
      curve(top, true);
      ctx!.lineTo(bottom[bottom.length - 1][0], bottom[bottom.length - 1][1]);
      curve(bottom, false);
      ctx!.closePath();
      ctx!.globalAlpha = 0.13 + layer * 0.035;
      ctx!.fillStyle = gradient;
      ctx!.fill();
      ctx!.globalAlpha = 0.55;
      ctx!.lineWidth = 1.4;
      ctx!.strokeStyle = gradient;
      ctx!.shadowColor = rgba(accent, 0.9);
      ctx!.shadowBlur = 16;
      ctx!.stroke();
      ctx!.shadowBlur = 0;
    }

    function draw(t: number) {
      const playing = usePlayer.getState().playing;
      if (t - accentAt > 500) {
        accent = readAccent(scratchCtx);
        accentAt = t;
      }
      sample(t, playing);

      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";

      let bass = 0;
      for (let i = 0; i < 5; i++) bass += bands[i];
      bass /= 5;
      const radius = height * (0.42 + bass * 0.4);
      const glow = ctx!.createRadialGradient(width * 0.3, height * 0.5, 0, width * 0.3, height * 0.5, radius);
      glow.addColorStop(0, rgba(accent, 0.1 + bass * 0.24));
      glow.addColorStop(1, rgba(accent, 0));
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, width, height);

      const gradient = ctx!.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgba(VIOLET, 1));
      gradient.addColorStop(0.5, rgba(accent, 1));
      gradient.addColorStop(1, rgba(AMBER, 1));
      for (let layer = 0; layer < LAYERS; layer++) ribbon(layer, t, gradient);

      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    }

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(performance.now());
    });
    observer.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="full-viz" aria-hidden="true" />;
}
