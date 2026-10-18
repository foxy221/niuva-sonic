import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "./desktop";
import { logError } from "./log";

/**
 * Zugangsdaten im Schlüsselbund des Betriebssystems.
 *
 * Unter Windows liegen Token und Salt in der Anmeldeinformationsverwaltung
 * (`src-tauri/src/secrets.rs`); in der Datei der Oberfläche steht dann nur noch
 * ein Verweis auf Server und Benutzer. Im Browser (Entwicklung ohne Tauri) gibt
 * es keinen Schlüsselbund; die Aufrufe melden das mit `false` bzw. `null`, und
 * der Aufrufer entscheidet, wie er damit umgeht.
 *
 * Der Schlüssel ist `<Serveradresse>|<Benutzer>`. Damit hat jedes
 * Server-Profil genau einen Eintrag.
 */

export function credentialsKey(creds: { serverUrl: string; username: string }) {
  return `${creds.serverUrl}|${creds.username}`;
}

/** Gibt es hier einen Schlüsselbund? */
export async function keychainAvailable(): Promise<boolean> {
  if (!isDesktopApp()) return false;
  try {
    return await invoke<boolean>("keychain_available");
  } catch (error) {
    logError(error, "Credential manager not reachable");
    return false;
  }
}

/** Legt ein Geheimnis ab. `false` heißt: kein Schlüsselbund vorhanden oder Schreibfehler. */
export async function saveSecret(key: string, secret: string): Promise<boolean> {
  if (!(await keychainAvailable())) return false;
  try {
    await invoke("save_credential", { key, secret });
    return true;
  } catch (error) {
    logError(error, "Credentials could not be stored in the credential manager");
    return false;
  }
}

/** Liest ein Geheimnis; `null`, wenn keines vorliegt oder kein Schlüsselbund da ist. */
export async function loadSecret(key: string): Promise<string | null> {
  if (!(await keychainAvailable())) return null;
  try {
    return await invoke<string | null>("load_credential", { key });
  } catch (error) {
    logError(error, "Credentials could not be read from the credential manager");
    return null;
  }
}

/** Entfernt ein Geheimnis; ein fehlender Eintrag ist kein Fehler. */
export async function deleteSecret(key: string): Promise<void> {
  if (!(await keychainAvailable())) return;
  try {
    await invoke("delete_credential", { key });
  } catch (error) {
    logError(error, "Credentials could not be removed from the credential manager");
  }
}
