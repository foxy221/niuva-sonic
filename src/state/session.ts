import { create } from "zustand";
import { SubsonicClient, SubsonicError, createAuth, normalizeServerUrl } from "../api/subsonic";
import type { Credentials } from "../api/types";
import { isDesktopApp } from "./desktop";
import { logError, logWrite } from "./log";
import { credentialsKey, loadSecret, saveSecret } from "./secrets";
import { readValue, removeValue, writeValue } from "./storage";

const STORE_FILE = "session.json";
const KEY = "credentials";

/**
 * Verweis auf den Schlüsselbund: Server und Benutzer, aber kein Token.
 * Die eigentlichen Zugangsdaten liegen in der Anmeldeinformationsverwaltung.
 */
interface CredentialsRef {
  serverUrl: string;
  username: string;
  keychain: true;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";

function validServerUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isCredentials(value: unknown): value is Credentials {
  if (!isRecord(value)) return false;
  if (!["serverUrl", "username", "token", "salt"].every((key) => typeof value[key] === "string" && (value[key] as string).trim().length > 0)) return false;
  return validServerUrl(value.serverUrl);
}

function isRef(value: unknown): value is CredentialsRef {
  if (!isRecord(value)) return false;
  return value.keychain === true && typeof value.username === "string" && value.username.trim().length > 0 && validServerUrl(value.serverUrl);
}

export function credentialsFromSecret(secret: string | null): Credentials | null {
  if (!secret) return null;
  try {
    const value: unknown = JSON.parse(secret);
    return isCredentials(value) ? value : null;
  } catch {
    return null;
  }
}
const readStored = () => readValue<unknown>(STORE_FILE, KEY);
const writeStored = (value: Credentials | CredentialsRef | null) =>
  value ? writeValue(STORE_FILE, KEY, value) : removeValue(STORE_FILE, KEY);

/**
 * Zugangsdaten ablegen: im Schlüsselbund, in der Datei steht nur der Verweis.
 * Ohne Schlüsselbund (Entwicklung im Browser) bleibt es beim bisherigen Weg.
 * In der App wird kein Token im Klartext abgelegt; ohne Schlüsselbund gilt die
 * Anmeldung dann nur für diese Sitzung.
 */
async function persistCredentials(creds: Credentials | null): Promise<void> {
  if (!creds) {
    // Abmelden beendet nur die Sitzung. Die Zugangsdaten bleiben im Schlüsselbund,
    // solange das Profil gemerkt ist; sonst ginge mit jedem Wechsel das vorige Profil verloren.
    await writeStored(null).catch(() => {});
    return;
  }
  if (await saveSecret(credentialsKey(creds), JSON.stringify(creds))) {
    await writeStored({ serverUrl: creds.serverUrl, username: creds.username, keychain: true }).catch(() => {});
    return;
  }
  if (!isDesktopApp()) {
    await writeStored(creds).catch(() => {});
    return;
  }
  logWrite("warn", "Kein Schlüsselbund verfügbar: die Anmeldung wird nicht gemerkt.");
  await writeStored(null).catch(() => {});
}

/** Gespeicherten Stand in Zugangsdaten übersetzen; räumt Unbrauchbares weg. */
async function resolveCredentials(stored: unknown): Promise<Credentials | null> {
  if (isRef(stored)) {
    const creds = credentialsFromSecret(await loadSecret(credentialsKey(stored)));
    if (creds) return creds;
    // Eintrag fehlt, etwa nach dem Aufräumen im Schlüsselbund: Verweis entfernen.
    logWrite("warn", "Im Schlüsselbund liegen keine Zugangsdaten mehr.");
    await writeStored(null).catch(() => {});
    return null;
  }
  if (isCredentials(stored)) {
    // Ältere Fassung: vollständige Zugangsdaten in der Datei. Jetzt umziehen.
    await persistCredentials(stored);
    return stored;
  }
  if (stored !== null) await writeStored(null).catch(() => {});
  return null;
}


interface SessionState {
  ready: boolean;
  client: SubsonicClient | null;
  creds: Credentials | null;
  restore: () => Promise<void>;
  login: (serverUrl: string, username: string, password: string) => Promise<void>;
  /** Vorhandene Zugangsdaten übernehmen (Profilwechsel): erst prüfen, dann anmelden. */
  adopt: (creds: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

let restoreTask: Promise<void> | null = null;
let sessionRevision = 0;

export const useSession = create<SessionState>((set) => ({
  ready: false,
  client: null,
  creds: null,

  async restore() {
    // Strict Mode startet den Effekt zweimal; beide Aufrufer teilen dieselbe Sitzung.
    if (restoreTask) return restoreTask;
    const revision = sessionRevision;
    restoreTask = (async () => {
      let creds: Credentials | null = null;
      let stored: unknown = null;
      try {
        stored = await readStored();
      } catch {
        // Ein beschädigter oder nicht lesbarer Store darf den Login nicht blockieren.
      }
      try {
        creds = await resolveCredentials(stored);
      } catch (error) {
        logError(error, "Sitzung konnte nicht wiederhergestellt werden");
      }
      if (revision === sessionRevision) set({ ready: true, creds, client: creds ? new SubsonicClient(creds) : null });
    })().finally(() => { restoreTask = null; });
    return restoreTask;
  },

  async login(serverUrl, username, password) {
    sessionRevision++;
    const { salt, token } = createAuth(password);
    const creds: Credentials = { serverUrl: normalizeServerUrl(serverUrl), username: username.trim(), salt, token };
    const client = new SubsonicClient(creds);
    const server = await client.ping();
    await persistCredentials(creds);
    set({ creds, client });
    logWrite("info", `Angemeldet an ${server.serverVersion ?? server.type ?? "Server"}`);
  },

  async adopt(creds) {
    sessionRevision++;
    const client = new SubsonicClient(creds);
    const server = await client.ping();
    await persistCredentials(creds);
    set({ creds, client });
    logWrite("info", `Profil gewechselt zu ${creds.username} (${server.serverVersion ?? server.type ?? "Server"})`);
  },

  async logout() {
    sessionRevision++;
    await persistCredentials(null);
    set({ creds: null, client: null });
    logWrite("info", "Abgemeldet");
  },
}));

export function describeLoginError(e: unknown) {
  if (e instanceof SubsonicError) {
    if (e.code === 40) return "Benutzername oder Passwort ist falsch.";
    return e.message;
  }
  return "Der Server ist nicht erreichbar. Adresse prüfen.";
}
