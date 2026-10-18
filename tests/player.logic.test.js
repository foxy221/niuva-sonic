import { describe, expect, it } from "vitest";
import {
  addListened,
  applyGain,
  clampIndex,
  gainFor,
  moveItem,
  nextIndex,
  prevIndex,
  removeAt,
  replayGainFactor,
  shouldScrobble,
  shuffled,
  streamOptions,
} from "../src/state/player.logic";
import { mergeSettings } from "../src/state/settings";

/** Feste Zufallszahlen, damit das Mischen nachvollziehbar bleibt. */
function sequence(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("shuffled", () => {
  it("behÃ¤lt alle Elemente, nur in anderer Reihenfolge", () => {
    const out = shuffled([1, 2, 3, 4, 5], sequence([0.1, 0.9, 0.4, 0.7]));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toEqual([1, 2, 3, 4, 5]);
  });

  it("lÃ¤sst die Eingabe unberÃ¼hrt", () => {
    const input = [1, 2, 3];
    shuffled(input, sequence([0.5]));
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("Listenpflege", () => {
  it("entfernt an der Stelle", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeAt(["a"], 0)).toEqual([]);
    expect(removeAt(["a"], 5)).toEqual(["a"]);
  });

  it("verschiebt EintrÃ¤ge", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("hÃ¤lt den Index im gÃ¼ltigen Bereich", () => {
    expect(clampIndex(3, 5)).toBe(3);
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(0, 0)).toBe(-1);
  });
});

describe("Titelwechsel", () => {
  it("folgt der Liste", () => {
    expect(nextIndex(0, 3, "off", false)).toBe(1);
    expect(nextIndex(2, 3, "off", false)).toBeNull();
  });

  it("springt am Ende zurÃ¼ck, wenn die Warteschlange wiederholt wird", () => {
    expect(nextIndex(2, 3, "queue", false)).toBe(0);
  });

  it("wiederholt den Titel nur beim natÃ¼rlichen Ende", () => {
    expect(nextIndex(1, 3, "track", true)).toBe(1);
    expect(nextIndex(1, 3, "track", false)).toBe(2);
  });

  it("kennt keine Nachbarn in einer leeren Liste", () => {
    expect(nextIndex(0, 0, "queue", true)).toBeNull();
    expect(prevIndex(0, 0, "queue")).toBe(0);
  });

  it("geht rÃ¼ckwÃ¤rts und am Anfang zur letzten Stelle", () => {
    expect(prevIndex(2, 3, "off")).toBe(1);
    expect(prevIndex(0, 3, "off")).toBe(0);
    expect(prevIndex(0, 3, "queue")).toBe(2);
  });
});

describe("HÃ¶rzeit und Scrobbling", () => {
  it("zÃ¤hlt nur normale Schritte", () => {
    expect(addListened(0, 0, 1)).toBe(1);
    expect(addListened(5, 10, 9)).toBe(5);
    // Sprung durch Spulen: kein Zuwachs.
    expect(addListened(5, 10, 40)).toBe(5);
  });

  it("meldet erst nach genug HÃ¶rzeit", () => {
    expect(shouldScrobble(29, 100)).toBe(false);
    expect(shouldScrobble(50, 100)).toBe(true);
    expect(shouldScrobble(60, 600)).toBe(false);
    expect(shouldScrobble(240, 600)).toBe(true);
  });
});

describe("ReplayGain", () => {
  it("rechnet dB in einen Faktor um", () => {
    expect(replayGainFactor(undefined)).toBe(1);
    expect(replayGainFactor(-6)).toBeCloseTo(0.5012, 3);
    expect(replayGainFactor(6)).toBeCloseTo(1.9953, 3);
  });

  it("begrenzt die Anhebung am Peak", () => {
    expect(replayGainFactor(12, 0.5)).toBe(2);
    expect(replayGainFactor(-6, 0.9)).toBeCloseTo(0.5012, 3);
  });

  it("nimmt im Albummodus den Albumwert", () => {
    const song = { replayGain: { trackGain: -6, albumGain: 0, albumPeak: 1 } };
    expect(gainFor(song, "off")).toBe(1);
    expect(gainFor(song, "track")).toBeCloseTo(0.5012, 3);
    expect(gainFor(song, "album")).toBeCloseTo(1, 3);
  });

  it("weicht auf andere Werte aus, wenn der passende fehlt", () => {
    expect(gainFor({ replayGain: { fallbackGain: -6 } }, "track")).toBeCloseTo(0.5012, 3);
    expect(gainFor({ replayGain: {} }, "album")).toBe(1);
    expect(gainFor({}, "track")).toBe(1);
  });

  it("Ã¼berschreitet die volle LautstÃ¤rke nicht", () => {
    expect(applyGain(0.8, 1)).toBeCloseTo(0.8, 5);
    expect(applyGain(0.8, 2)).toBe(1);
    expect(applyGain(0.5, 0.5)).toBeCloseTo(0.25, 5);
  });
});

describe("Transcoding-Parameter", () => {
  it("lÃ¤sst die Originaldatei unverÃ¤ndert", () => {
    expect(streamOptions({ maxBitRate: 0, format: "" })).toEqual({ maxBitRate: undefined, format: undefined });
  });

  it("gibt Grenze und Format weiter", () => {
    expect(streamOptions({ maxBitRate: 128, format: "opus" })).toEqual({ maxBitRate: 128, format: "opus" });
  });
});

describe("Einstellungen", () => {
  it("nutzt Vorgaben ohne gespeicherte Werte", () => {
    expect(mergeSettings(null)).toEqual(mergeSettings({}));
    expect(mergeSettings(null).gapless).toBe(true);
  });

  it("Ã¼bernimmt gÃ¼ltige Werte", () => {
    const stored = { maxBitRate: 128, format: "mp3", replayGain: "album", gapless: false, scrobble: false, rememberQueue: false, offlineLimitGb: 20 };
    expect(mergeSettings(stored)).toEqual(stored);
  });

  it("ersetzt unbrauchbare Werte durch Vorgaben", () => {
    const merged = mergeSettings({ maxBitRate: -5, format: 7, replayGain: "laut", gapless: "ja" });
    expect(merged.maxBitRate).toBe(0);
    expect(merged.format).toBe("");
    expect(merged.replayGain).toBe("off");
    expect(merged.gapless).toBe(true);
  });
});
