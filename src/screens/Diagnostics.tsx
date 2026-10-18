import { useEffect, useState, type ReactNode } from "react";
import { Activity, CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { ServerInfo } from "../api/types";
import { formatBytes } from "../format";
import { t, useT } from "../i18n";
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
  if (check.state === "running") return t("diag.checkRunning");
  if (check.state === "ok") return t("diag.checkOk", { ms: check.ms ?? 0 });
  if (check.state === "error") return t("diag.checkError", { message: check.message ?? "" });
  return t("diag.checkIdle");
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
  const tr = useT();
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
    ? `${server.type ?? tr("diag.unknown")}${server.serverVersion ? ` ${server.serverVersion}` : ""}${server.openSubsonic ? " · OpenSubsonic" : ""}`
    : capabilitiesError
      ? tr("diag.serverFailed", { error: capabilitiesError })
      : tr("diag.serverLoading");

  return (
    <section className="diagnostics">
      <h1>{tr("nav.diagnostics")}</h1>

      <Panel id="verbindung" title={tr("diag.connection")}>
        <dl className="diag-facts">
          <div><dt>{tr("diag.account")}</dt><dd>{creds ? tr("diag.accountLine", { user: creds.username, server: creds.serverUrl }) : tr("diag.notSignedIn")}</dd></div>
          <div><dt>{tr("diag.server")}</dt><dd>{serverLine}</dd></div>
          <div>
            <dt>{tr("diag.check")}</dt>
            <dd className={`diag-check ${check.state}`} role="status">
              {check.state === "running" && <LoaderCircle size={16} className="spin" aria-hidden="true" />}
              {check.state === "ok" && <CircleCheck size={16} aria-hidden="true" />}
              {check.state === "error" && <CircleAlert size={16} aria-hidden="true" />}
              {describeCheck(check)}
            </dd>
          </div>
        </dl>
        <div className="diag-actions">
          <button type="button" onClick={() => void pingNow()} disabled={!client || check.state === "running"}><Activity size={18} /> {tr("diag.checkNow")}</button>
        </div>
      </Panel>

      <Panel id="faehigkeiten" title={tr("diag.capabilities")}>
        {names.length ? (
          <ul className="chips">
            {names.map((name) => (
              <li key={name}>{name} <span className="muted">{tr("diag.version", { versions: extensions[name].join(", ") })}</span></li>
            ))}
          </ul>
        ) : (
          <p className="muted">{server ? tr("diag.noExtensions") : tr("diag.noInfo")}</p>
        )}
      </Panel>

      <Panel id="offline" title={tr("nav.offline")}>
        <p className="muted">
          {isDesktopApp()
            ? tr("diag.offlineLine", { tracks: tr("count.tracks", { count: offlineSongs }), size: formatBytes(offlineUsage ?? 0), measuring: offlineReady ? "" : tr("diag.measuring"), path: offlineBaseDir ?? tr("diag.unknown") })
            : tr("settings.offlineAppOnly")}
        </p>
      </Panel>

      <Panel id="ablage" title={tr("diag.storage")}>
        <p className="muted">
          {keychain === null ? tr("diag.keychainChecking") : keychain ? tr("diag.keychainOk") : tr("diag.keychainNone")}
        </p>
        <p className="muted">{tr("diag.profiles", { count: profileCount })}</p>
      </Panel>

      <Panel id="protokoll" title={tr("diag.log")}>
        <p className="muted diag-path">{logPath ? tr("diag.logFile", { path: logPath }) : tr("diag.logWhere")}</p>
        {logProblem && <p className="form-error" role="alert"><CircleAlert size={18} /> {logProblem}</p>}
        {logLines.length ? (
          <pre className="diag-log" tabIndex={0} aria-label={tr("diag.logLines")}>{logLines.join("\n")}</pre>
        ) : (
          <p className="muted">{tr("diag.logEmpty")}</p>
        )}
        <div className="diag-actions">
          <button type="button" className="ghost" onClick={() => void useLog.getState().refresh()}><RefreshCw size={16} /> {tr("diag.reload")}</button>
          <button type="button" className="ghost" onClick={() => void useLog.getState().clear()}><Trash2 size={16} /> {tr("diag.clearLog")}</button>
        </div>
      </Panel>
    </section>
  );
}
