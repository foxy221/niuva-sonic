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

/** Sprache der Oberfläche an die Hülle melden, damit das Tray-Menü mitzieht. */
export async function setAppLanguage(language: string): Promise<void> {
  if (!isDesktopApp()) return;
  await invoke("set_language", { language });
}

/** Befehle, die Tray-Menü und Medientasten auslösen. */
export type PlayerCommand = "toggle" | "next" | "previous";

export const isDesktopApp = () => "__TAURI_INTERNALS__" in window && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

/** Lädt die gefundene Fassung herunter und prüft ihre Signatur; liefert die Versionsnummer. */
export function downloadUpdate(): Promise<string> {
  return invoke<string>("download_update");
}

/** Spielt das geladene Update ein. Unter Windows beendet der Installer die App und startet sie neu. */
export function installUpdate(): Promise<void> {
  return invoke<void>("install_update");
}

/** Fortschritt des Update-Downloads; `total` kann 0 sein, wenn der Server keine Länge meldet. */
export function onUpdateProgress(handler: (progress: { received: number; total: number }) => void): Promise<UnlistenFn> {
  return listen<{ received: number; total: number }>("update-progress", (event) => handler(event.payload));
}

/** Liegt das Tray-Symbol vor? Ohne es beendet Schließen die App normal. */
export function trayReady(): Promise<boolean> {
  return invoke<boolean>("tray_ready");
}

/** Tray-Menü und Medientasten melden sich hier. */
export function onPlayerCommand(handler: (command: PlayerCommand) => void): Promise<UnlistenFn> {
  return listen<string>("player-command", (event) => handler(event.payload as PlayerCommand));
}

// --- Offline-Ablage (src-tauri/src/offline.rs) ---------------------------

/** Fortschritt eines laufenden Downloads; `total` kann 0 sein, wenn der Server keine Länge meldet. */
export interface DownloadProgress {
  jobId: string;
  received: number;
  total: number;
}

/** Eine erfolgreich in die Offline-Ablage geschriebene Datei. */
export interface DownloadedFile {
  path: string;
  size: number;
}

/** Meldet den Fortschritt laufender Downloads. */
export function onDownloadProgress(handler: (progress: DownloadProgress) => void): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (event) => handler(event.payload));
}

/** Lädt eine Datei in die Offline-Ablage; `relPath` ist relativ zur Ablage-Wurzel. */
export function startDownload(input: { jobId: string; url: string; relPath: string }): Promise<DownloadedFile> {
  return invoke<DownloadedFile>("download_file", input);
}

/** Bricht den laufenden Download eines Jobs ab. */
export function cancelDownload(jobId: string): Promise<boolean> {
  return invoke<boolean>("cancel_download", { jobId });
}

/** Absoluter Pfad der Offline-Ablage, für die Wiedergabe lokaler Dateien. */
export function offlineBaseDir(): Promise<string> {
  return invoke<string>("offline_base_dir");
}

/** Belegte Größe der Offline-Ablage in Bytes. */
export function offlineDiskUsage(): Promise<number> {
  return invoke<number>("offline_disk_usage");
}

/** Löscht eine Datei aus der Offline-Ablage. */
export function deleteOfflineFile(relPath: string): Promise<void> {
  return invoke<void>("delete_offline_file", { relPath });
}

/** Leert die gesamte Offline-Ablage und meldet die freigegebenen Bytes. */
export function clearOffline(): Promise<number> {
  return invoke<number>("clear_offline");
}
