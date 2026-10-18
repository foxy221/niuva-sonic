import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { SubsonicClient } from "../src/api/subsonic";
import { profileId, useProfiles, validProfiles } from "../src/state/profiles";
import { credentialsFromSecret, useSession } from "../src/state/session";
import { credentialsKey, keychainAvailable } from "../src/state/secrets";

/**
 * Zugangsdaten und Profile.
 *
 * Die Hülle ist nachgestellt: `invoke` bedient Schlüsselbund und Protokoll,
 * `plugin-store` eine Ablage im Speicher. Geprüft wird, dass in der App kein
 * Token mehr in der Datei landet, dass ältere Einträge umziehen und dass der
 * Profilwechsel über den Schlüsselbund läuft.
 */

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

const creds = { serverUrl: "https://musik.example", username: "A", token: "t".repeat(32), salt: "salz" };
const key = credentialsKey(creds);

/** Schlüsselbund im Speicher. */
const keychain = new Map();
/** Dateien des Stores im Speicher: Dateiname → Schlüssel → Wert. */
const files = new Map();
let keychainWorks = true;

function storeValue(file, entryKey) {
  return files.get(file)?.get(entryKey) ?? null;
}

function implementMocks() {
  vi.mocked(invoke).mockImplementation(async (command, args = {}) => {
    switch (command) {
      case "keychain_available":
        return keychainWorks;
      case "save_credential":
        if (!keychainWorks) throw new Error("Kein Schlüsselbund");
        keychain.set(args.key, args.secret);
        return null;
      case "load_credential":
        if (!keychainWorks) throw new Error("Kein Schlüsselbund");
        return keychain.get(args.key) ?? null;
      case "delete_credential":
        if (!keychainWorks) throw new Error("Kein Schlüsselbund");
        keychain.delete(args.key);
        return null;
      case "log_message":
        return null;
      default:
        throw new Error(`Unerwarteter Befehl: ${command}`);
    }
  });
  vi.mocked(load).mockImplementation(async (file) => {
    if (!files.has(file)) files.set(file, new Map());
    const map = files.get(file);
    return {
      set: async (entryKey, value) => { map.set(entryKey, value); },
      get: async (entryKey) => map.get(entryKey) ?? null,
      delete: async (entryKey) => { map.delete(entryKey); },
      save: async () => {},
    };
  });
}

beforeEach(() => {
  keychain.clear();
  files.clear();
  keychainWorks = true;
  implementMocks();
  useSession.setState({ ready: true, creds: null, client: null });
  useProfiles.setState({ ready: true, list: [], error: null, busy: false });
  vi.spyOn(SubsonicClient.prototype, "ping").mockResolvedValue({ type: "navidrome", serverVersion: "0.64.2", openSubsonic: true });
});

afterEach(() => {
  delete window.__TAURI_INTERNALS__;
});

describe("Sitzung mit Schlüsselbund", () => {
  it("legt die Zugangsdaten im Schlüsselbund ab und in der Datei nur einen Verweis", async () => {
    window.__TAURI_INTERNALS__ = {};

    await useSession.getState().login("musik.example", "A", "geheim");

    expect(keychain.get(key)).toBeTruthy();
    const secret = JSON.parse(keychain.get(key));
    expect(secret).toMatchObject({ serverUrl: creds.serverUrl, username: "A" });
    expect(secret.token).toHaveLength(32);
    expect(secret.salt).toHaveLength(12);
    const stored = storeValue("session.json", "credentials");
    expect(stored).toEqual({ serverUrl: creds.serverUrl, username: "A", keychain: true });
    expect(JSON.stringify(stored)).not.toContain("token");
  });

  it("stellt die Sitzung aus dem Schlüsselbund wieder her", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");
    useSession.setState({ ready: false, creds: null, client: null });

    await useSession.getState().restore();

    expect(useSession.getState().creds).toMatchObject({ serverUrl: creds.serverUrl, username: "A" });
    expect(useSession.getState().client).toBeInstanceOf(SubsonicClient);
  });

  it("zieht ältere Zugangsdaten aus der Datei in den Schlüsselbund um", async () => {
    window.__TAURI_INTERNALS__ = {};
    files.set("session.json", new Map([["credentials", creds]]));

    await useSession.getState().restore();

    expect(useSession.getState().creds).toEqual(creds);
    expect(keychain.get(key)).toBe(JSON.stringify(creds));
    expect(storeValue("session.json", "credentials")).toEqual({ serverUrl: creds.serverUrl, username: "A", keychain: true });
  });

  it("räumt einen Verweis ohne Eintrag im Schlüsselbund weg", async () => {
    window.__TAURI_INTERNALS__ = {};
    files.set("session.json", new Map([["credentials", { serverUrl: creds.serverUrl, username: "A", keychain: true }]]));

    await useSession.getState().restore();

    expect(useSession.getState().creds).toBeNull();
    expect(storeValue("session.json", "credentials")).toBeNull();
  });

  it("entfernt beim Abmelden den Eintrag aus dem Schlüsselbund", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");

    await useSession.getState().logout();

    expect(keychain.size).toBe(0);
    expect(storeValue("session.json", "credentials")).toBeNull();
    expect(useSession.getState().creds).toBeNull();
  });

  it("legt in der App ohne Schlüsselbund kein Token in der Datei ab", async () => {
    window.__TAURI_INTERNALS__ = {};
    keychainWorks = false;

    await useSession.getState().login("musik.example", "A", "geheim");

    expect(useSession.getState().creds).not.toBeNull();
    expect(storeValue("session.json", "credentials")).toBeNull();
    expect(keychain.size).toBe(0);
  });

  it("bleibt im Browser beim bisherigen Weg", async () => {
    await useSession.getState().login("musik.example", "A", "geheim");

    const stored = JSON.parse(localStorage.getItem("credentials"));
    expect(stored).toMatchObject({ username: "A", serverUrl: creds.serverUrl });
    expect(stored.salt).toHaveLength(12);
    expect(stored.token).toHaveLength(32);
    expect(await keychainAvailable()).toBe(false);
  });

  it("erkennt unbrauchbare Geheimnisse", () => {
    expect(credentialsFromSecret(JSON.stringify(creds))).toEqual(creds);
    expect(credentialsFromSecret(null)).toBeNull();
    expect(credentialsFromSecret("{kaputt")).toBeNull();
    expect(credentialsFromSecret(JSON.stringify({ ...creds, token: "" }))).toBeNull();
    expect(credentialsFromSecret(JSON.stringify({ ...creds, serverUrl: "javascript:alert(1)" }))).toBeNull();
  });
});

describe("Server-Profile", () => {
  const other = { serverUrl: "https://zweit.example", username: "B", token: "u".repeat(32), salt: "salz2" };

  it("merkt sich jede erfolgreiche Anmeldung ohne Zugangsdaten", async () => {
    window.__TAURI_INTERNALS__ = {};

    await useSession.getState().login("musik.example", "A", "geheim");

    expect(useProfiles.getState().list).toEqual([{ serverUrl: creds.serverUrl, username: "A" }]);
    // Das Merken läuft im Hintergrund; der Test wartet auf den Schreibvorgang.
    await vi.waitFor(() => expect(storeValue("profiles.json", "profiles")).toHaveLength(1));
    expect(JSON.stringify(storeValue("profiles.json", "profiles"))).not.toContain("token");
  });

  it("wechselt über den Schlüsselbund zu einem anderen Server", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");
    await useSession.getState().login("zweit.example", "B", "geheim2");
    keychain.set(credentialsKey(other), JSON.stringify(other));

    await useProfiles.getState().activate({ serverUrl: other.serverUrl, username: "B" });
    expect(useProfiles.getState().error).toBeNull();
    expect(storeValue("session.json", "credentials")).toMatchObject({ username: "B", keychain: true });

    // Ohne Zugangsdaten im Schlüsselbund sagt der Wechsel ab.
    expect(await useProfiles.getState().activate({ serverUrl: "https://dritt.example", username: "C" })).toBe(false);
  });

  it("meldet fehlende Zugangsdaten, statt die Sitzung zu wechseln", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");

    await useProfiles.getState().activate({ serverUrl: other.serverUrl, username: "B" });

    expect(useProfiles.getState().error).toContain("keine Zugangsdaten");
    expect(useSession.getState().creds?.username).toBe("A");
  });

  it("meldet einen fehlgeschlagenen Wechsel", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");
    keychain.set(credentialsKey(other), JSON.stringify(other));
    vi.mocked(SubsonicClient.prototype.ping).mockRejectedValueOnce(new Error("Server nicht erreichbar"));

    await useProfiles.getState().activate({ serverUrl: other.serverUrl, username: "B" });

    expect(useProfiles.getState().error).toContain("Server nicht erreichbar");
    expect(useSession.getState().creds?.username).toBe("A");
    expect(useProfiles.getState().busy).toBe(false);
  });

  it("entfernt ein Profil samt Eintrag im Schlüsselbund", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");
    const profile = { serverUrl: creds.serverUrl, username: "A" };

    await useProfiles.getState().remove(profile);

    expect(useProfiles.getState().list).toEqual([]);
    expect(keychain.size).toBe(0);
    expect(storeValue("profiles.json", "profiles")).toEqual([]);
  });

  it("meldet beim Entfernen des aktiven Profils ab", async () => {
    window.__TAURI_INTERNALS__ = {};
    await useSession.getState().login("musik.example", "A", "geheim");

    await useProfiles.getState().remove({ serverUrl: creds.serverUrl, username: "A" });

    expect(useSession.getState().creds).toBeNull();
    expect(storeValue("session.json", "credentials")).toBeNull();
  });

  it("überschreibt gemerkte Profile nicht, wenn die Sitzung vor dem Login-Bildschirm zurückkommt", async () => {
    window.__TAURI_INTERNALS__ = {};
    files.set("profiles.json", new Map([["profiles", [{ serverUrl: other.serverUrl, username: "B" }]]]));
    useProfiles.setState({ ready: false, list: [] });

    await useSession.getState().login("musik.example", "A", "geheim");

    await vi.waitFor(() => expect(storeValue("profiles.json", "profiles")).toHaveLength(2));
    expect(useProfiles.getState().list.map((p) => p.username).sort()).toEqual(["A", "B"]);
  });

  it("liest gespeicherte Profile ohne Zugangsdaten wieder ein", async () => {
    files.set("profiles.json", new Map([["profiles", [{ serverUrl: creds.serverUrl, username: "A" }]]]));

    await useProfiles.getState().restore();

    expect(useProfiles.getState().list).toEqual([{ serverUrl: creds.serverUrl, username: "A" }]);
    expect(profileId(useProfiles.getState().list[0])).toBe(key);
  });

  it("verwirft unbrauchbare und doppelte Einträge", () => {
    expect(validProfiles(null)).toEqual([]);
    expect(validProfiles([{ serverUrl: "https://a.example", username: "A" }, { serverUrl: "https://a.example", username: "A" }])).toHaveLength(1);
    expect(validProfiles([{ serverUrl: "", username: "A" }, { username: "B" }, "quatsch", { serverUrl: "https://c.example", username: " C " }])).toEqual([
      { serverUrl: "https://c.example", username: "C" },
    ]);
  });
});
