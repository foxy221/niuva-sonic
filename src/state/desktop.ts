import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Brücke zur Desktop-Hülle (Tauri). Die Befehle liegen in `src-tauri/src/commands.rs`;
 * im Browser gibt es sie nicht, deshalb prüft jede Stelle zuerst `isDesktopApp()`.
 */

/** Einstellungen, die die Hülle verwaltet: Tray und Medientasten. */
export interface WindowPrefs {
  closeToTray: boolean;
  globalShortcuts: boolean;
}

export interface UpdateStatus {
  state: "notConfigured" | "upToDate" | "available" | "error";
  currentVersion: string;
  version: string | null;
  message: string | null;
}

/** Befehle, die Tray-Menü und Medientasten auslösen. */
export type PlayerCommand = "toggle" | "next" | "previous";

export const isDesktopApp = () => "__TAURI_INTERNALS__" in window;

export function readWindowPrefs(): Promise<WindowPrefs> {
  return invoke<WindowPrefs>("window_prefs");
}

export function setCloseToTray(enabled: boolean): Promise<WindowPrefs> {
  return invoke<WindowPrefs>("set_close_to_tray", { enabled });
}

/** Kann fehlschlagen, wenn eine andere App die Medientaste hält. */
export function setGlobalShortcuts(enabled: boolean): Promise<WindowPrefs> {
  return invoke<WindowPrefs>("set_global_shortcuts", { enabled });
}

export function checkForUpdate(): Promise<UpdateStatus> {
  return invoke<UpdateStatus>("check_for_update");
}

/** Tray-Menü und Medientasten melden sich hier. */
export function onPlayerCommand(handler: (command: PlayerCommand) => void): Promise<UnlistenFn> {
  return listen<string>("player-command", (event) => handler(event.payload as PlayerCommand));
}
