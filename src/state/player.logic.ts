import type { ReplayGain, StreamOptions } from "../api/types";
import type { ReplayGainMode } from "./settings";

export type RepeatMode = "off" | "queue" | "track";

/** Reihenfolge der Wiederholarten beim Weiterschalten in der Oberfläche. */
export const repeatOrder: RepeatMode[] = ["off", "queue", "track"];

/** Fisher-Yates auf einer Kopie; `random` ist für Tests austauschbar. */
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function removeAt<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items.slice();
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice();
  const out = items.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}

/**
 * Nächster Titel oder `null`, wenn die Wiedergabe endet.
 * `automatic` heißt: der Titel ist zu Ende gelaufen, nicht der Nutzer hat gedrückt.
 */
export function nextIndex(index: number, length: number, repeat: RepeatMode, automatic: boolean): number | null {
  if (length <= 0) return null;
  if (automatic && repeat === "track") return index;
  if (index + 1 < length) return index + 1;
  return repeat === "queue" ? 0 : null;
}

export function prevIndex(index: number, length: number, repeat: RepeatMode): number {
  if (index > 0) return index - 1;
  return repeat === "queue" && length > 0 ? length - 1 : index;
}

/**
 * Zählt nur echte Hörzeit mit. Ein Sprung durch Spulen ergibt einen großen
 * Abstand zwischen zwei Messpunkten und zählt deshalb nicht.
 */
export function addListened(listened: number, previous: number, position: number, maxStep = 3): number {
  const delta = position - previous;
  if (delta <= 0 || delta > maxStep) return listened;
  return listened + delta;
}

/** Übliche Regel: mindestens 30 Sekunden und die halbe Länge oder vier Minuten. */
export function shouldScrobble(listened: number, duration: number): boolean {
  if (listened < 30) return false;
  if (duration > 0 && listened >= duration / 2) return true;
  return listened >= 240;
}

/** ReplayGain in einen Lautstärkefaktor; der Peak begrenzt die Anhebung. */
export function replayGainFactor(gainDb?: number, peak?: number): number {
  if (typeof gainDb !== "number" || !Number.isFinite(gainDb)) return 1;
  const factor = 10 ** (gainDb / 20);
  if (typeof peak === "number" && peak > 0) return Math.min(factor, 1 / peak);
  return factor;
}

/** Faktor für einen Titel; ohne Tags bleibt es bei 1. */
export function gainFor(song: { replayGain?: ReplayGain }, mode: ReplayGainMode): number {
  if (mode === "off") return 1;
  const rg = song.replayGain;
  if (!rg) return 1;
  if (mode === "album") {
    return replayGainFactor(rg.albumGain ?? rg.trackGain ?? rg.fallbackGain, rg.albumPeak ?? rg.trackPeak);
  }
  return replayGainFactor(rg.trackGain ?? rg.albumGain ?? rg.fallbackGain, rg.trackPeak ?? rg.albumPeak);
}

/** Nutzerlautstärke mal ReplayGain, nie über 1. */
export function applyGain(volume: number, factor: number): number {
  return Math.max(0, Math.min(1, volume * factor));
}

/** Einstellungen in `stream`-Parameter übersetzen. */
export function streamOptions(settings: { maxBitRate: number; format: string }): StreamOptions {
  return {
    maxBitRate: settings.maxBitRate > 0 ? settings.maxBitRate : undefined,
    format: settings.format || undefined,
  };
}
