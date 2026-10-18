import { create } from "zustand";
import { readValue, writeValue } from "./storage";

const FILE = "settings.json";
const KEY = "playbackSettings";

export type ReplayGainMode = "off" | "track" | "album";

export interface PlaybackSettings {
  /** Obergrenze in kbit/s; 0 = Originaldatei. */
  maxBitRate: number;
  /** Zielformat; leer = Originalformat. */
  format: string;
  replayGain: ReplayGainMode;
  /** Nächsten Titel vorladen und ohne Ladepause übernehmen. */
  gapless: boolean;
  /** Wiedergaben an den Server melden (`scrobble`). */
  scrobble: boolean;
  /** Warteschlange und Position beim Beenden merken. */
  rememberQueue: boolean;
}

export const defaultSettings: PlaybackSettings = {
  maxBitRate: 0,
  format: "",
  replayGain: "off",
  gapless: true,
  scrobble: true,
  rememberQueue: true,
};

/** Auswahl für die Oberfläche; die Werte sind die Parameter aus `stream`. */
export const bitRateOptions = [0, 64, 96, 128, 192, 320] as const;
export const formatOptions = ["", "mp3", "opus", "aac"] as const;

interface SettingsState {
  settings: PlaybackSettings;
  restore: () => Promise<void>;
  update: (patch: Partial<PlaybackSettings>) => void;
}

/** Fehlende oder unbrauchbare Felder fallen auf die Vorgaben zurück. */
export function mergeSettings(stored: unknown): PlaybackSettings {
  if (!stored || typeof stored !== "object") return { ...defaultSettings };
  const raw = stored as Record<string, unknown>;
  return {
    maxBitRate: typeof raw.maxBitRate === "number" && Number.isFinite(raw.maxBitRate) && raw.maxBitRate >= 0 ? raw.maxBitRate : defaultSettings.maxBitRate,
    format: typeof raw.format === "string" ? raw.format : defaultSettings.format,
    replayGain: raw.replayGain === "track" || raw.replayGain === "album" ? raw.replayGain : "off",
    gapless: typeof raw.gapless === "boolean" ? raw.gapless : defaultSettings.gapless,
    scrobble: typeof raw.scrobble === "boolean" ? raw.scrobble : defaultSettings.scrobble,
    rememberQueue: typeof raw.rememberQueue === "boolean" ? raw.rememberQueue : defaultSettings.rememberQueue,
  };
}

let revision = 0;

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings,

  async restore() {
    const started = revision;
    const stored = await readValue<unknown>(FILE, KEY).catch(() => null);
    if (started === revision) set({ settings: mergeSettings(stored) });
  },

  update(patch) {
    revision++;
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void writeValue(FILE, KEY, settings).catch(() => {});
  },
}));
