import { t } from "../i18n";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { isDesktopApp } from "./desktop";

/**
 * Fehlerprotokoll.
 *
 * In der App landet jede Meldung in einer Datei (`src-tauri/src/logfile.rs`);
 * die Diagnoseansicht liest sie über `read_log` und zeigt die letzten Zeilen.
 * Ohne Tauri (Entwicklung im Browser) bleibt es bei der Konsole, damit die
 * Meldungen nicht verloren gehen.
 */

export type LogLevel = "error" | "warn" | "info";

export interface LogTail {
  path: string;
  lines: string[];
}

/** Meldung schreiben. Fehler beim Schreiben dürfen die App nicht stören. */
export function logWrite(level: LogLevel, message: string): void {
  const line = `[niuva] ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  if (!isDesktopApp()) return;
  void invoke("log_message", { level, message }).catch(() => {});
}

/** Fehler mit Zusammenhang protokollieren; nimmt alles, was geworfen wird. */
export function logError(error: unknown, context: string): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  logWrite("error", `${context}: ${detail}`);
}

interface LogState {
  ready: boolean;
  /** Pfad der Protokolldatei; `null` ohne Datei (Browser). */
  path: string | null;
  lines: string[];
  error: string | null;
  refresh: (maxLines?: number) => Promise<void>;
  clear: () => Promise<void>;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useLog = create<LogState>((set, get) => ({
  ready: false,
  path: null,
  lines: [],
  error: null,

  async refresh(maxLines = 200) {
    if (!isDesktopApp()) {
      set({ ready: true, path: null, lines: [], error: null });
      return;
    }
    try {
      const tail = await invoke<LogTail>("read_log", { maxLines });
      set({ ready: true, path: tail.path, lines: tail.lines, error: null });
    } catch (error) {
      set({ ready: true, error: t("diag.logUnreadable", { error: describe(error) }) });
    }
  },

  async clear() {
    if (!isDesktopApp()) return;
    try {
      await invoke("clear_log");
      await get().refresh();
    } catch (error) {
      set({ error: t("diag.clearFailed", { error: describe(error) }) });
    }
  },
}));
