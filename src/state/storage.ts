import { load } from "@tauri-apps/plugin-store";

/**
 * Kleine Ablage für Zustand, der einen Neustart überlebt.
 * In Tauri schreibt sie über `plugin-store` in eine Datei, im Browser
 * (`pnpm dev` ohne Tauri) in `localStorage` unter demselben Schlüssel.
 */
const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function readValue<T>(file: string, key: string): Promise<T | null> {
  if (!isTauri()) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Beschädigter Eintrag: lieber ohne Zustand starten als abstürzen.
      return null;
    }
  }
  const store = await load(file);
  return (await store.get<T>(key)) ?? null;
}

export async function writeValue<T>(file: string, key: string, value: T): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  const store = await load(file);
  await store.set(key, value);
  await store.save();
}

export async function removeValue(file: string, key: string): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(key);
    return;
  }
  const store = await load(file);
  await store.delete(key);
  await store.save();
}
