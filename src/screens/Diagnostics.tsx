import { useEffect, useState, type ReactNode } from "react";
import { Activity, CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
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

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="diag-panel" aria-labelledby={`diag-${id}`}>
      <h2 id={`diag-${id}`}>{title}</h2>
      {children}
    </section>
  );
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
  const serverLine = server
    ? `${server.type ?? "Unbekannt"}${server.serverVersion ? ` ${server.serverVersion}` : ""}${server.openSubsonic ? " · OpenSubsonic" : ""}`
    : capabilitiesError
      ? `Serverkennung fehlgeschlagen: ${capabilitiesError}`
      : "Serverkennung wird geladen …";

  return (
    <section className="diagnostics">
      <h1>Diagnose</h1>

      <Panel id="verbindung" title="Verbindung">
        <dl className="diag-facts">
          <div><dt>Konto</dt><dd>{creds ? `${creds.username} an ${creds.serverUrl}` : "Nicht angemeldet."}</dd></div>
          <div><dt>Server</dt><dd>{serverLine}</dd></div>
          <div>
            <dt>Prüfung</dt>
            <dd className={`diag-check ${check.state}`} role="status">
              {check.state === "running" && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
              {check.state === "ok" && <CircleCheck size={16} aria-hidden="true" />}
              {check.state === "error" && <CircleAlert size={16} aria-hidden="true" />}
              {describeCheck(check)}
            </dd>
          </div>
        </dl>
        <div className="diag-actions">
          <button type="button" onClick={() => void pingNow()} disabled={!client || check.state === "running"}><Activity size={18} /> Verbindung prüfen</button>
        </div>
      </Panel>

      <Panel id="faehigkeiten" title="Gemeldete Fähigkeiten">
        {names.length ? (
          <ul className="chips">
            {names.map((name) => (
              <li key={name}>{name} <span className="muted">Fassung {extensions[name].join(", ")}</span></li>
            ))}
          </ul>
        ) : (
          <p className="muted">{server ? "Der Server meldet keine OpenSubsonic-Erweiterungen." : "Noch keine Auskunft vom Server."}</p>
        )}
      </Panel>

      <Panel id="offline" title="Offline">
        <p className="muted">
          {isDesktopApp()
            ? `${offlineSongs} Titel, ${formatBytes(offlineUsage ?? 0)}${offlineReady ? "" : " (wird gemessen)"} unter ${offlineBaseDir ?? "unbekannt"}.`
            : "Downloads und Offline-Wiedergabe gibt es nur in der installierten App."}
        </p>
      </Panel>

      <Panel id="ablage" title="Ablage">
        <p className="muted">
          {keychain === null ? "Schlüsselbund wird geprüft …" : keychain ? "Die Zugangsdaten liegen im Schlüsselbund des Betriebssystems." : "Kein Schlüsselbund verfügbar; in der App wird die Anmeldung dann nicht gemerkt."}
        </p>
        <p className="muted">{profileCount === 1 ? "Ein gemerktes Server-Profil." : `${profileCount} gemerkte Server-Profile.`}</p>
      </Panel>

      <Panel id="protokoll" title="Protokoll">
        <p className="muted diag-path">{logPath ? `Datei: ${logPath}` : "In der installierten App liegt das Protokoll in einer Datei; im Browser steht es in der Konsole."}</p>
        {logProblem && <p className="form-error" role="alert"><CircleAlert size={18} /> {logProblem}</p>}
        {logLines.length ? (
          <pre className="diag-log" tabIndex={0} aria-label="Letzte Protokollzeilen">{logLines.join("\n")}</pre>
        ) : (
          <p className="muted">Keine Einträge.</p>
        )}
        <div className="diag-actions">
          <button type="button" className="ghost" onClick={() => void useLog.getState().refresh()}><RefreshCw size={16} /> Neu laden</button>
          <button type="button" className="ghost" onClick={() => void useLog.getState().clear()}><Trash2 size={16} /> Protokoll leeren</button>
        </div>
      </Panel>
    </section>
  );
}
