const cache = new Map<string, string | null>();

function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** Hintergrund, auf dem die Akzentfarbe als Text stehen muss (hellster der Panel-Töne, `--raised-hover`). */
const SURFACE_LUMINANCE = 0.0137;

function luminance(h: number, s: number, l: number): number {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

/** Hellt die Farbe auf, bis Text in ihr auf dunklen Flächen mindestens 4,5:1 erreicht (WCAG AA). Blaue Cover brauchen mehr als 62 % Helligkeit. */
export function readableLightness(h: number, s: number, start = 0.62): number {
  let l = start;
  while (l < 0.9 && (luminance(h, s, l) + 0.05) / (SURFACE_LUMINANCE + 0.05) < 4.5) l += 0.01;
  return l;
}

/** Zieht eine kräftige Leitfarbe aus dem Cover: gewichtet nach Sättigung, auf lesbare Helligkeit gezogen. */
export async function accentFromImage(url: string): Promise<string | null> {
  if (cache.has(url)) return cache.get(url)!;
  const color = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets = Array.from({ length: 12 }, () => ({ weight: 0, h: 0, s: 0, count: 0 }));
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
          if (l < 0.12 || l > 0.92) continue;
          const weight = s * s * (1 - Math.abs(l - 0.5));
          const bucket = buckets[Math.floor(h / 30) % 12];
          bucket.weight += weight;
          bucket.h += h * weight;
          bucket.s += s * weight;
          bucket.count++;
        }
        const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a));
        if (best.weight < 0.3) return resolve(null);
        const h = best.h / best.weight;
        const s = Math.min(0.9, Math.max(0.6, best.s / best.weight));
        resolve(`hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(readableLightness(h, s) * 100).toFixed(0)}%)`);
      } catch {
        resolve(null);
      }
    };
    img.src = url;
  });
  cache.set(url, color);
  return color;
}
