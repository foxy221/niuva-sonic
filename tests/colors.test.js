import { describe, expect, it } from "vitest";
import { completeSwatches, extractSwatches, readableLightness } from "../src/design/colors";

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

/** RGBA-Pixel aus Blöcken gleicher Farbe: [[r, g, b, Anzahl], ...]. */
const pixels = (blocks) => Uint8ClampedArray.from(blocks.flatMap(([r, g, b, n]) => Array(n).fill([r, g, b, 255]).flat()));

describe("Wolkenpalette aus dem Cover", () => {
  it("findet drei Leitfarben aus Rot, Blau und Grün", () => {
    const found = extractSwatches(pixels([[230, 30, 40, 300], [30, 60, 230, 200], [40, 200, 70, 150]]));
    expect(found).toHaveLength(3);
    expect(found[0].h).toBeLessThan(10 + 360 * Number(found[0].h > 350));
    expect(new Set(found.map((w) => Math.round(w.h / 60))).size).toBe(3);
  });

  it("lässt Nebenfarben mit zu wenig Gewicht und zu ähnliche Farbtöne weg", () => {
    const found = extractSwatches(pixels([[230, 30, 40, 400], [230, 80, 30, 380], [30, 60, 230, 20]]));
    expect(found).toHaveLength(1);
  });

  it("liefert nichts bei Grau, Schwarz oder Weiß (Rückfall auf die Logo-Farben)", () => {
    expect(extractSwatches(pixels([[128, 128, 128, 500], [0, 0, 0, 300], [255, 255, 255, 200]]))).toEqual([]);
    expect(completeSwatches([])).toEqual([]);
  });

  it("ergänzt fehlende Leitfarben durch Abwandlungen der ersten", () => {
    const [first, second, third] = completeSwatches([{ h: 300, s: 0.8 }]);
    expect(first).toEqual({ h: 300, s: 0.8 });
    expect(second.h).toBeCloseTo(335);
    expect(third.h).toBeCloseTo(265);
    expect(completeSwatches([{ h: 10, s: 0.7 }, { h: 200, s: 0.7 }, { h: 100, s: 0.7 }])).toHaveLength(3);
  });
});
