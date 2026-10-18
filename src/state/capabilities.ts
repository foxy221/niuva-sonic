import { create } from "zustand";
import type { ServerInfo } from "../api/types";
import { logError, logWrite } from "./log";
import { useSession } from "./session";

/**
 * Was der Server kann.
 *
 * `ping` nennt Typ und Fassung; meldet der Server `openSubsonic`, fragen wir
 * zusätzlich `getOpenSubsonicExtensions` ab. Danach richtet sich, welche
 * bereits gebauten Funktionen überhaupt etwas bringen: ReplayGain-Felder
 * liefern nur OpenSubsonic-Server, und der Hinweis in den Einstellungen sagt
 * dann, warum die Auswahl wirkungslos bleibt.
 */

export interface CapabilitiesState {
  ready: boolean;
  /** Kennung des Servers; `null`, solange nichts geantwortet hat. */
  server: ServerInfo | null;
  /** Name der Erweiterung → gemeldete Fassungen. */
  extensions: Record<string, number[]>;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
  /** Meldet der Server diese Erweiterung in mindestens dieser Fassung? */
  supports: (name: string, minVersion?: number) => boolean;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Fassungen ohne Angabe gelten als Fassung 1. */
function versionMap(list: { name: string; versions?: number[] }[]): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const entry of list) {
    if (typeof entry?.name !== "string" || !entry.name) continue;
    map[entry.name] = Array.isArray(entry.versions) ? entry.versions.filter((v) => typeof v === "number") : [1];
  }
  return map;
}

let revision = 0;

export const useCapabilities = create<CapabilitiesState>((set, get) => ({
  ready: false,
  server: null,
  extensions: {},
  error: null,

  async load() {
    const started = ++revision;
    const client = useSession.getState().client;
    if (!client) {
      set({ ready: true, server: null, extensions: {}, error: null });
      return;
    }
    set({ ready: false, error: null });
    try {
      const server = await client.ping();
      let extensions: Record<string, number[]> = {};
      if (server.openSubsonic) {
        try {
          extensions = versionMap(await client.getOpenSubsonicExtensions());
        } catch (error) {
          // Ein Server darf `openSubsonic` melden und den Aufruf trotzdem nicht kennen.
          logError(error, "Could not query OpenSubsonic extensions");
        }
      }
      if (started !== revision) return;
      set({ ready: true, server, extensions, error: null });
      logWrite("info", `Server detected: ${server.type ?? "unknown"} ${server.serverVersion ?? ""}${server.openSubsonic ? " (OpenSubsonic)" : ""}`.trim());
    } catch (error) {
      if (started !== revision) return;
      logError(error, "Could not query server identification");
      set({ ready: true, server: null, extensions: {}, error: describe(error) });
    }
  },

  reset() {
    revision++;
    set({ ready: false, server: null, extensions: {}, error: null });
  },

  supports(name, minVersion = 1) {
    const versions = get().extensions[name];
    return Array.isArray(versions) && versions.some((version) => version >= minVersion);
  },
}));

/** ReplayGain-Werte schickt nur ein OpenSubsonic-Server mit. */
export function replayGainSupported(server: ServerInfo | null): boolean {
  return Boolean(server?.openSubsonic);
}

// Beim Wechsel der Sitzung neu ermitteln; sonst zeigte die Diagnose den alten Server.
useSession.subscribe((session, previous) => {
  if (session.client === previous.client) return;
  void useCapabilities.getState().load();
});
