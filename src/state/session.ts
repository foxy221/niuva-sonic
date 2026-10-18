import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";
import { SubsonicClient, SubsonicError, createAuth, normalizeServerUrl } from "../api/subsonic";
import type { Credentials } from "../api/types";

const STORE_FILE = "session.json";
const KEY = "credentials";

// Im Browser (pnpm dev ohne Tauri) faellt die Persistenz auf localStorage zurueck.
const isTauri = () => "__TAURI_INTERNALS__" in window;

async function readCredentials(): Promise<unknown> {
  if (!isTauri()) return JSON.parse(localStorage.getItem(KEY) ?? "null");
  const store = await load(STORE_FILE);
  return (await store.get<Credentials>(KEY)) ?? null;
}

function isCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== "object") return false;
  const fields = value as Record<string, unknown>;
  if (!["serverUrl", "username", "token", "salt"].every((key) => typeof fields[key] === "string" && fields[key].trim().length > 0)) return false;
  try {
    const url = new URL(fields.serverUrl as string);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function writeCredentials(creds: Credentials | null) {
  if (!isTauri()) {
    if (creds) localStorage.setItem(KEY, JSON.stringify(creds));
    else localStorage.removeItem(KEY);
    return;
  }
  const store = await load(STORE_FILE);
  if (creds) await store.set(KEY, creds);
  else await store.delete(KEY);
  await store.save();
}

interface SessionState {
  ready: boolean;
  client: SubsonicClient | null;
  creds: Credentials | null;
  restore: () => Promise<void>;
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  ready: false,
  client: null,
  creds: null,

  async restore() {
    let creds: Credentials | null = null;
    try {
      const stored = await readCredentials();
      if (isCredentials(stored)) creds = stored;
      else if (stored !== null) await writeCredentials(null);
    } catch {
      // Ein beschädigter oder nicht lesbarer Store darf den Login nicht blockieren.
    }
    set({ ready: true, creds, client: creds ? new SubsonicClient(creds) : null });
  },

  async login(serverUrl, username, password) {
    const { salt, token } = createAuth(password);
    const creds: Credentials = { serverUrl: normalizeServerUrl(serverUrl), username: username.trim(), salt, token };
    const client = new SubsonicClient(creds);
    await client.ping();
    await writeCredentials(creds);
    set({ creds, client });
  },

  async logout() {
    await writeCredentials(null);
    set({ creds: null, client: null });
  },
}));

export function describeLoginError(e: unknown) {
  if (e instanceof SubsonicError) {
    if (e.code === 40) return "Benutzername oder Passwort ist falsch.";
    return e.message;
  }
  return "Der Server ist nicht erreichbar. Adresse prüfen.";
}
