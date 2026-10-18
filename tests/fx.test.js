import { describe, expect, it } from "vitest";
import { BeatFx, MAX_SPARKS } from "../src/design/fx";

/** Schlag-Effekte des Visualizers: wann es Ringe und Funken gibt und wann sie verschwinden. */

const bands = new Float32Array(48).fill(0.4);
const input = (patch = {}) => ({
  dt: 16,
  bands,
  kicks: { bass: 0, mid: 0, high: 0 },
  energy: 0.5,
  width: 1920,
  height: 1080,
  cover: { x: 500, y: 540, r: 300 },
  playing: true,
  ...patch,
});
const kick = (bass, high = 0) => input({ kicks: { bass, mid: 0, high } });
/** Zufall ohne Streuung, damit die Zählungen stabil bleiben. */
const fixed = () => new BeatFx(() => 0.5);

describe("Schockwellen und Funken", () => {
  it("löst bei einem Bass-Schlag einen Ring und einen Funkenschwarm vom Cover-Rand aus", () => {
    const fx = fixed();

    fx.update(kick(0.9));

    expect(fx.rings).toHaveLength(1);
    const burst = fx.sparks.filter((spark) => spark.kind === "burst");
    expect(burst.length).toBeGreaterThanOrEqual(8);
    // Alle Funken starten am Rand des Covers und sind im ersten Schritt erst ein Stück gewandert.
    for (const spark of burst) {
      const distance = Math.hypot(spark.x - 500, spark.y - 540);
      expect(distance).toBeGreaterThanOrEqual(270);
      expect(distance).toBeLessThan(345);
    }
  });

  it("wartet zwischen zwei Schlägen kurz ab, damit ein langer Bass keinen Ringteppich erzeugt", () => {
    const fx = fixed();

    fx.update(kick(0.9));
    for (let i = 0; i < 5; i++) fx.update(kick(0.9)); // 5 × 16 ms < 240 ms
    expect(fx.rings).toHaveLength(1);

    for (let i = 0; i < 15; i++) fx.update(kick(0.9));
    expect(fx.rings.length).toBe(2);
  });

  it("ignoriert schwache Schläge und alles bei Pause", () => {
    const fx = fixed();
    fx.update(kick(0.3));
    fx.update(input({ kicks: { bass: 0.95, mid: 0, high: 0.95 }, playing: false }));

    expect(fx.rings).toHaveLength(0);
    expect(fx.sparks.filter((spark) => spark.kind !== "ember")).toHaveLength(0);
  });

  it("streut bei hellen Schlägen kurzlebiges Glitzern über die Fläche", () => {
    const fx = fixed();

    fx.update(kick(0, 0.9));

    expect(fx.sparks.filter((spark) => spark.kind === "glitter").length).toBeGreaterThanOrEqual(3);
  });

  it("lässt Ringe und Funken nach ihrer Lebensdauer verschwinden", () => {
    const fx = fixed();
    fx.update(kick(0.9, 0.9));
    expect(fx.rings.length + fx.sparks.length).toBeGreaterThan(0);

    for (let i = 0; i < 250; i++) fx.update(input({ dt: 16, playing: false })); // 4 s ohne Schlag
    expect(fx.rings).toHaveLength(0);
    expect(fx.sparks.filter((spark) => spark.kind !== "ember")).toHaveLength(0);
  });

  it("hält die Zahl der Funken unter der Grenze, auch bei Dauerfeuer", () => {
    const fx = new BeatFx();
    for (let i = 0; i < 2000; i++) fx.update(kick(1, 1));

    expect(fx.sparks.length).toBeLessThanOrEqual(MAX_SPARKS);
  });

  it("lässt Glut aufsteigen, bei lauter Musik dichter als bei leiser", () => {
    const quiet = fixed();
    const loud = fixed();
    for (let i = 0; i < 120; i++) {
      quiet.update(input({ energy: 0.05 }));
      loud.update(input({ energy: 1 }));
    }

    const embers = (fx) => fx.sparks.filter((spark) => spark.kind === "ember");
    expect(embers(loud).length).toBeGreaterThan(embers(quiet).length);
    for (const ember of embers(loud)) expect(ember.vy).toBeLessThan(0);
  });
});

describe("Zeichnen", () => {
  /** Minimaler 2D-Kontext, der nur die Aufrufe mitschreibt. */
  function recorder() {
    const calls = [];
    const target = {
      createLinearGradient: () => ({ addColorStop() {} }),
    };
    return new Proxy(target, {
      get(obj, name) {
        if (name in obj) return obj[name];
        if (name === "calls") return calls;
        return (...args) => { calls.push(name); return args; };
      },
      set() { return true; },
    });
  }

  it("zeichnet Spektrum, Ringe und Funken und räumt zuerst die Fläche", () => {
    const fx = fixed();
    fx.update(kick(0.9));
    const ctx = recorder();

    fx.draw(ctx, kick(0.9), ["#f39", "#83f", "#fb4", "#fff"], 1);

    expect(ctx.calls[0]).toBe("clearRect");
    expect(ctx.calls).toContain("quadraticCurveTo");
    expect(ctx.calls.filter((name) => name === "arc").length).toBeGreaterThan(2);
  });
});
