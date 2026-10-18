import { load } from "@tauri-apps/plugin-store";

/**
 * Kleine Ablage für Zustand, der einen Neustart überlebt.
 * In Tauri schreibt sie über `plugin-store` in eine Datei, im Browser
 * (`pnpm dev` ohne Tauri) in `localStorage` unter demselben Schlüssel.
 */
const isTauri = () => "__TAURI_INTERNALS__" in window;
const pendingWrites = new Map<string, Promise<void>>();

/** Vor dem nativen Beenden auch bereits angestoßene Einstellungen/Deletes abwarten. */
export async function flushWrites(): Promise<void> {
  await Promise.all([...pendingWrites.values()].map((task) => task.catch(() => {})));
}

/** Pro Datei in Aufrufreihenfolge schreiben: ein spätes Save darf kein Delete überholen. */
function writeNative(file: string, change: () => Promise<void>) {
  const task = (pendingWrites.get(file) ?? Promise.resolve()).catch(() => {}).then(change);
  pendingWrites.set(file, task);
  const clean = () => { if (pendingWrites.get(file) === task) pendingWrites.delete(file); };
  void task.then(clean, clean);
  return task;
}

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
  await pendingWrites.get(file)?.catch(() => {});
  const store = await load(file);
  return (await store.get<T>(key)) ?? null;
}

export async function writeValue<T>(file: string, key: string, value: T): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  await writeNative(file, async () => {
    const store = await load(file);
    await store.set(key, value);
    await store.save();
  });
}

export async function removeValue(file: string, key: string): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(key);
    return;
  }
  await writeNative(file, async () => {
    const store = await load(file);
    await store.delete(key);
    await store.save();
  });
}
