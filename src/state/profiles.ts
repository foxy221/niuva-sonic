import { create } from "zustand";
import { credentialsFromSecret, useSession } from "./session";
import { credentialsKey, deleteSecret, loadSecret } from "./secrets";
import { logError, logWrite } from "./log";
import { readValue, writeValue } from "./storage";

/**
 * Mehrere Server-Profile.
 *
 * Gemerkt werden nur Serveradresse und Benutzername; die Zugangsdaten liegen je
 * Profil im Schlüsselbund (`src/state/secrets.ts`). Das Umschalten lädt sie von
 * dort, prüft die Verbindung und übernimmt die Sitzung.
 */

const FILE = "profiles.json";
const KEY = "profiles";

export interface Profile {
  serverUrl: string;
  username: string;
}

export interface ProfilesState {
  ready: boolean;
  list: Profile[];
  error: string | null;
  /** Ein Wechsel läuft; die Oberfläche sperrt die Schaltflächen. */
  busy: boolean;
  restore: () => Promise<void>;
  /** Profil übernehmen; `false`, wenn keine Zugangsdaten vorliegen oder die Prüfung scheitert. */
  activate: (profile: Profile) => Promise<boolean>;
  remove: (profile: Profile) => Promise<void>;
}

export const profileId = (profile: Profile) => credentialsKey(profile);
const same = (a: Profile, b: Profile) => profileId(a) === profileId(b);
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Beschädigte Einträge fallen weg, doppelte werden zusammengefasst. */
export function validProfiles(value: unknown): Profile[] {
  if (!Array.isArray(value)) return [];
  const list: Profile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { serverUrl, username } = entry as Record<string, unknown>;
    if (typeof serverUrl !== "string" || typeof username !== "string") continue;
    if (!serverUrl.trim() || !username.trim()) continue;
    const profile = { serverUrl, username: username.trim() };
    if (list.some((known) => same(known, profile))) continue;
    list.push(profile);
  }
  return list;
}

const persist = (list: Profile[]) => writeValue(FILE, KEY, list).catch(() => {});

export const useProfiles = create<ProfilesState>((set, get) => ({
  ready: false,
  list: [],
  error: null,
  busy: false,

  async restore() {
    const stored = await readValue<unknown>(FILE, KEY).catch(() => null);
    set({ ready: true, list: validProfiles(stored) });
  },

  async activate(profile) {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      const creds = credentialsFromSecret(await loadSecret(profileId(profile)));
      if (!creds) {
        set({ error: `Für ${profile.username} liegen keine Zugangsdaten im Schlüsselbund. Bitte neu anmelden.` });
        return false;
      }
      await useSession.getState().adopt(creds);
      return true;
    } catch (error) {
      logError(error, `Profilwechsel zu ${profile.username} fehlgeschlagen`);
      set({ error: describe(error) });
      return false;
    } finally {
      set({ busy: false });
    }
  },

  async remove(profile) {
    const list = get().list.filter((entry) => !same(entry, profile));
    set({ list });
    await persist(list);
    await deleteSecret(profileId(profile));
    logWrite("info", `Profil entfernt: ${profile.username}`);
    // Das aktive Profil ohne Zugangsdaten weiterlaufen zu lassen, hielte beim nächsten Start nur eine tote Anmeldung.
    const { creds, logout } = useSession.getState();
    if (creds && same(creds, profile)) await logout();
  },
}));

/** Jede erfolgreiche Anmeldung merkt sich das Profil – ohne Zugangsdaten. */
useSession.subscribe((session, previous) => {
  if (!session.creds || session.creds === previous.creds) return;
  const profile = { serverUrl: session.creds.serverUrl, username: session.creds.username };
  void (async () => {
    // Erst die gespeicherte Liste laden: Sonst überschriebe der erste Eintrag
    // nach dem Start (Sitzung wiederhergestellt, Login nie gezeigt) die übrigen Profile.
    if (!useProfiles.getState().ready) await useProfiles.getState().restore();
    const { list } = useProfiles.getState();
    if (list.some((known) => same(known, profile))) return;
    const next = [...list, profile];
    useProfiles.setState({ list: next });
    await persist(next);
  })();
});
