import type { StructuredLyrics } from "./api/types";

/** Bevorzugt synchrone Texte; unter gleichen gewinnt der erste, der Zeilen hat. */
export function pickLyrics(list: StructuredLyrics[]): StructuredLyrics | null {
  const usable = list.filter((entry) => entry.line.some((line) => line.value.trim()));
  return usable.find((entry) => entry.synced) ?? usable[0] ?? null;
}

/**
 * Index der Zeile, die bei `seconds` gesungen wird; -1 vor der ersten Zeile.
 * Zeilen müssen nach `start` aufsteigen, wie der Server sie liefert.
 */
export function activeLineIndex(lyrics: StructuredLyrics, seconds: number): number {
  if (!lyrics.synced) return -1;
  const ms = seconds * 1000 - (lyrics.offset ?? 0);
  let found = -1;
  for (let i = 0; i < lyrics.line.length; i++) {
    const start = lyrics.line[i].start;
    if (typeof start !== "number") continue;
    if (start <= ms) found = i;
    else break;
  }
  return found;
}
