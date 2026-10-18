import { useEffect, useState } from "react";
import type { ServerInfo } from "../api/types";
import { formatBytes } from "../format";
import { isDesktopApp } from "../state/desktop";
import { useCapabilities } from "../state/capabilities";
import { useLog } from "../state/log";
import { useOffline } from "../state/offline";
import { useProfiles } from "../state/profiles";
import { keychainAvailable } from "../state/secrets";
import { useSession } from "../state/session";

/**
 * Diagnose: Verbindungsprüfung, gemeldete Serverfähigkeiten, Offline-Ablage,
 * Sicherheit der Ablage und die letzten Zeilen des Protokolls.
 *
 * Bewusst schlichtes Markup (Überschriften, Listen, Text, Knöpfe) – die
 * Gestaltung zieht das Design nach.
 */

interface Check {
  state: "idle" | "running" | "ok" | "error";
  ms?: number;
  server?: ServerInfo;
  message?: string;
}

function describeCheck(check: Check) {
  if (check.state === "running") return "Der Server wird gefragt …";
  if (check.state === "ok") return `Antwort in ${check.ms} ms.`;
  if (check.state === "error") return `Keine Antwort: ${check.message}`;
  return "Noch nicht geprüft.";
}

export default function Diagnostics() {
  const { creds, client } = useSession();
  const server = useCapabilities((s) => s.server);
  const capabilitiesError = useCapabilities((s) => s.error);
  const extensions = useCapabilities((s) => s.extensions);
  const logPath = useLog((s) => s.path);
  const logLines = useLog((s) => s.lines);
  const logProblem = useLog((s) => s.error);
  const offlineReady = useOffline((s) => s.ready);
  const offlineSongs = useOffline((s) => Object.keys(s.songs).length);
  const offlineUsage = useOffline((s) => s.usage);
  const offlineBaseDir = useOffline((s) => s.baseDir);
  const profileCount = useProfiles((s) => s.list.length);
  const [keychain, setKeychain] = useState<boolean | null>(null);
  const [check, setCheck] = useState<Check>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    void keychainAvailable().then((available) => { if (!cancelled) setKeychain(available); });
    void useLog.getState().refresh();
    return () => { cancelled = true; };
  }, []);

  async function pingNow() {
    if (!client) return;
    setCheck({ state: "running" });
    const started = performance.now();
    try {
      const info = await client.ping();
      setCheck({ state: "ok", ms: Math.round(performance.now() - started), server: info });
    } catch (error) {
      setCheck({ state: "error", ms: Math.round(performance.now() - started), message: error instanceof Error ? error.message : String(error) });
    }
  }

  const names = Object.keys(extensions).sort();

  return (
    <section className="diagnostics">
      <h1>Diagnose</h1>

      <h2>Verbindung</h2>
      <p className="muted">{creds ? `Angemeldet als ${creds.username} an ${creds.serverUrl}` : "Nicht angemeldet."}</p>
      <p className="muted">
        {server
          ? `Server: ${server.type ?? "unbekannt"}${server.serverVersion ? ` ${server.serverVersion}` : ""}${server.openSubsonic ? ", OpenSubsonic" : ""}`
          : capabilitiesError
            ? `Serverkennung fehlgeschlagen: ${capabilitiesError}`
            : "Serverkennung wird geladen …"}
      </p>
      <p className="muted">{describeCheck(check)}</p>
      <button type="button" className="ghost" onClick={() => void pingNow()} disabled={!client || check.state === "running"}>Verbindung prüfen</button>

      <h2>Gemeldete Fähigkeiten</h2>
      {names.length ? (
        <ul className="muted">
          {names.map((name) => (
            <li key={name}>{name} (Fassung {extensions[name].join(", ")})</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{server ? "Der Server meldet keine OpenSubsonic-Erweiterungen." : "Noch keine Auskunft vom Server."}</p>
      )}

      <h2>Offline</h2>
      <p className="muted">
        {isDesktopApp()
          ? `${offlineSongs} Titel, ${formatBytes(offlineUsage ?? 0)}${offlineReady ? "" : " (wird gemessen)"} unter ${offlineBaseDir ?? "unbekannt"}.`
          : "Downloads und Offline-Wiedergabe gibt es nur in der installierten App."}
      </p>

      <h2>Ablage</h2>
      <p className="muted">
        {keychain === null ? "Schlüsselbund wird geprüft …" : keychain ? "Die Zugangsdaten liegen im Schlüsselbund des Betriebssystems." : "Kein Schlüsselbund verfügbar; in der App wird die Anmeldung dann nicht gemerkt."}
      </p>
      <p className="muted">{profileCount === 1 ? "Ein gemerktes Server-Profil." : `${profileCount} gemerkte Server-Profile.`}</p>

      <h2>Protokoll</h2>
      <p className="muted">{logPath ? `Datei: ${logPath}` : "In der installierten App liegt das Protokoll in einer Datei; im Browser steht es in der Konsole."}</p>
      {logProblem && <p className="state error" role="alert">{logProblem}</p>}
      {logLines.length ? (
        <pre className="muted" aria-label="Letzte Protokollzeilen">{logLines.join("\n")}</pre>
      ) : (
        <p className="muted">Keine Einträge.</p>
      )}
      <button type="button" className="ghost" onClick={() => void useLog.getState().refresh()}>Neu laden</button>{" "}
      <button type="button" className="ghost" onClick={() => void useLog.getState().clear()}>Protokoll leeren</button>
    </section>
  );
}
