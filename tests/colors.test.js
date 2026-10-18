import { describe, expect, it } from "vitest";
import { readableLightness } from "../src/design/colors";

/** Unabhängige Gegenrechnung: HSL → sRGB → relative Luminanz → Kontrast gegen `--raised-hover` (#231742). */
function contrastOnSurface(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6].map((v) => v + m);
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const surface = (() => {
    const ch = [0x23, 0x17, 0x42].map((v) => lin(v / 255));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  })();
  return (lum + 0.05) / (surface + 0.05);
}

describe("Akzentfarbe aus dem Cover", () => {
  it("erreicht für jeden Farbton und jede Sättigung WCAG AA auf der hellsten Panel-Fläche", () => {
    for (let h = 0; h < 360; h += 5) {
      for (const s of [0.6, 0.75, 0.9]) {
        expect(contrastOnSurface(h, s, readableLightness(h, s)), `Farbton ${h}, Sättigung ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("lässt helle Farbtöne bei der Ausgangshelligkeit und hellt blaue auf", () => {
    expect(readableLightness(330, 0.9)).toBeCloseTo(0.62, 2);
    expect(readableLightness(240, 0.9)).toBeGreaterThan(0.62);
  });
});
