import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleAlert, LoaderCircle, LogOut, Plus, Stethoscope, UserRound } from "lucide-react";
import Segmented from "../components/Segmented";
import Switch from "../components/Switch";
import { formatBytes } from "../format";
import { SHORTCUTS } from "../hooks/shortcuts";
import { LANGUAGES, t, useLanguage, useT, type MessageKey } from "../i18n";
import { replayGainSupported, useCapabilities } from "../state/capabilities";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  isDesktopApp,
  onUpdateProgress,
  readWindowPrefs,
  setCloseToTray,
  setGlobalShortcuts,
  trayReady,
  type UpdateStatus,
  type WindowPrefs,
} from "../state/desktop";
import { offlineSupported, useOffline } from "../state/offline";
import { profileId, useProfiles } from "../state/profiles";
import { credentialsKey, keychainAvailable } from "../state/secrets";
import { bitRateOptions, formatOptions, limitOptions, useSettings, type PlaybackSettings } from "../state/settings";
import { describeLoginError, useSession } from "../state/session";
import { usePlayer } from "../state/player";

/** Wo das Update im Ablauf steht: gefunden, wird geladen, geladen, wird eingespielt. */
type UpdatePhase = "idle" | "downloading" | "ready" | "installing";

function Setting({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="setting">
      <div className="setting-text">
        <strong>{title}</strong>
        <p className="muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

const gains: { value: PlaybackSettings["replayGain"]; label: MessageKey }[] = [
  { value: "off", label: "settings.gainOff" },
  { value: "track", label: "settings.gainTrack" },
  { value: "album", label: "settings.gainAlbum" },
];

/**
 * Weiteren Server hinzufügen, ohne sich abzumelden. Gelingt die Anmeldung nicht,
 * bleibt die laufende Sitzung unberührt (`login` prüft vor dem Umschalten).
 */
function AddProfile() {
  const tr = useT();
  const login = useSession((s) => s.login);
  const [open, setOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(serverUrl, username, password);
      setOpen(false);
      setServerUrl("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(describeLoginError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" className="ghost add-profile" onClick={() => setOpen(true)}><Plus size={18} /> {tr("settings.addProfile")}</button>;
  }
  return (
    <form className="add-profile-form" onSubmit={submit}>
      <p className="muted">{tr("settings.addProfileHint")}</p>
      <label>{tr("login.server")}<input type="url" inputMode="url" placeholder="https://musik.example.de" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required autoFocus /></label>
      <label>{tr("login.username")}<input type="text" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
      <label>{tr("login.password")}<input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p className="form-error" role="alert"><CircleAlert size={18} /> {error}</p>}
      <div className="add-profile-actions">
        <button type="submit" disabled={busy}>{busy ? <><LoaderCircle size={18} className="spin" /> {tr("login.connecting")}</> : tr("settings.addProfileSubmit")}</button>
        <button type="button" className="ghost" disabled={busy} onClick={() => { setOpen(false); setError(null); setPassword(""); }}>{tr("common.cancel")}</button>
      </div>
    </form>
  );
}

/** Zustandstext der Update-Prüfung. */
export function describeUpdate(status: UpdateStatus | null): string {
  if (!status) return t("update.notChecked");
  if (status.state === "notConfigured") return t("update.notConfigured", { current: status.currentVersion ?? "" });
  if (status.state === "upToDate") return t("update.upToDate", { current: status.currentVersion ?? "" });
  if (status.state === "available") return t("update.available", { version: status.version ?? "", current: status.currentVersion ?? "" });
  return t("update.checkFailed", { message: status.message ?? "" });
}

/** Zusatz zum Prüfergebnis, solange ein Update geladen oder eingespielt wird. */
export function describePhase(phase: UpdatePhase, version: string | null, percent: number | null): string {
  if (phase === "downloading") return percent === null ? t("update.downloading", { version: version ?? "" }) : t("update.downloadingPercent", { version: version ?? "", percent });
  if (phase === "ready") return t("update.ready", { version: version ?? "" });
  if (phase === "installing") return t("update.installing", { version: version ?? "" });
  return "";
}

export default function Settings() {
  const tr = useT();
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const bitRates = bitRateOptions.map((value) => ({ value, label: value === 0 ? tr("settings.original") : String(value) }));
  const formats = formatOptions.map((value) => ({ value, label: value === "" ? tr("settings.original") : value.toUpperCase() }));
  const limits = limitOptions.map((value) => ({ value, label: value === 0 ? tr("settings.unlimited") : `${value} GB` }));
  const gainOptions = gains.map(({ value, label }) => ({ value, label: tr(label) }));
  const { settings, update } = useSettings();
  const { creds, logout } = useSession();
  const desktop = isDesktopApp();
  const server = useCapabilities((s) => s.server);
  const capabilitiesReady = useCapabilities((s) => s.ready);
  const profiles = useProfiles((s) => s.list);
  const switchProfile = useProfiles((s) => s.activate);
  const removeProfile = useProfiles((s) => s.remove);
  const profileBusy = useProfiles((s) => s.busy);
  const profileProblem = useProfiles((s) => s.error);
  const offlineReady = useOffline((s) => s.ready);
  const usage = useOffline((s) => s.usage);
  const offlineCount = useOffline((s) => Object.keys(s.songs).length);
  const clearAll = useOffline((s) => s.clearAll);
  const [windowPrefs, setWindowPrefs] = useState<WindowPrefs | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [updatePercent, setUpdatePercent] = useState<number | null>(null);
  const [hasTray, setHasTray] = useState(true);
  const [keychain, setKeychain] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);
  const updateRequest = useRef(0);
  const activeProfile = creds ? credentialsKey(creds) : null;

  useEffect(() => {
    let cancelled = false;
    void keychainAvailable().then((available) => { if (!cancelled) setKeychain(available); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    void readWindowPrefs()
      .then((prefs) => { if (!cancelled) setWindowPrefs(prefs); })
      .catch(() => { if (!cancelled) setProblem(tr("settings.windowReadFailed")); });
    void trayReady()
      .then((ready) => { if (!cancelled) setHasTray(ready); })
      .catch(() => { if (!cancelled) setHasTray(true); });
    const request = ++updateRequest.current;
    void checkForUpdate()
      .then((status) => { if (!cancelled && request === updateRequest.current) setUpdateStatus(status); })
      .catch(() => { if (!cancelled && request === updateRequest.current) setUpdateStatus(null); });
    return () => { cancelled = true; };
  }, [desktop]);

  /** Änderung an der Hülle: erst übernehmen lassen, dann anzeigen. */
  async function change(action: () => Promise<WindowPrefs>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    try {
      setWindowPrefs(await action());
    } catch (error) {
      setProblem(typeof error === "string" ? error : tr("settings.changeFailed"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function searchUpdate() {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++updateRequest.current;
    setBusy(true);
    setProblem(null);
    try {
      const status = await checkForUpdate();
      if (request === updateRequest.current) {
        setUpdateStatus(status);
        // Eine neue Suche verwirft ein bereits geladenes Paket nur, wenn die Fassung wechselt; das entscheidet die Hülle.
        if (status.state !== "available") setUpdatePhase("idle");
      }
    } catch {
      setProblem(tr("update.searchFailed"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function fetchUpdate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    setUpdatePercent(null);
    setUpdatePhase("downloading");
    const stop = await onUpdateProgress(({ received, total }) => setUpdatePercent(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null)).catch(() => null);
    try {
      await downloadUpdate();
      setUpdatePhase("ready");
    } catch (error) {
      setUpdatePhase("idle");
      setProblem(tr("update.downloadFailed", { error: typeof error === "string" ? error : tr("update.unknownError") }));
    } finally {
      stop?.();
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function applyUpdate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setProblem(null);
    setUpdatePhase("installing");
    try {
      // Unter Windows beendet der Installer die App: Warteschlange und Position vorher sichern.
      await usePlayer.getState().flush().catch((error: unknown) => console.error("Could not save the player state.", error));
      await installUpdate();
    } catch (error) {
      setUpdatePhase("ready");
      setProblem(tr("update.installFailed", { error: typeof error === "string" ? error : tr("update.unknownError") }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="settings">
      <h1>{tr("nav.settings")}</h1>

      <h2>{tr("settings.language")}</h2>
      <Setting title={tr("settings.language")} hint={tr("settings.languageHint")}>
        <Segmented label={tr("settings.language")} value={language} options={LANGUAGES} onChange={setLanguage} />
      </Setting>

      <h2>{tr("settings.sound")}</h2>
      <Setting title={tr("settings.quality")} hint={tr("settings.qualityHint")}>
        <Segmented label={tr("settings.quality")} value={settings.maxBitRate} options={bitRates} onChange={(maxBitRate) => update({ maxBitRate })} />
      </Setting>
      <Setting title={tr("settings.format")} hint={tr("settings.formatHint")}>
        <Segmented label={tr("settings.format")} value={settings.format} options={formats} onChange={(format) => update({ format })} />
      </Setting>
      <Setting
        title={tr("settings.gain")}
        hint={
          replayGainSupported(server)
            ? tr("settings.gainHint")
            : capabilitiesReady
              ? tr("settings.gainUnsupported")
              : tr("settings.gainChecking")
        }
      >
        <Segmented label={tr("settings.gain")} value={settings.replayGain} options={gainOptions} disabled={!replayGainSupported(server)} onChange={(replayGain) => update({ replayGain })} />
      </Setting>

      <h2>{tr("settings.playback")}</h2>
      <Setting title={tr("settings.gapless")} hint={tr("settings.gaplessHint")}>
        <Switch label={tr("settings.gapless")} checked={settings.gapless} onChange={(gapless) => update({ gapless })} />
      </Setting>
      <Setting title={tr("settings.scrobble")} hint={tr("settings.scrobbleHint")}>
        <Switch label={tr("settings.scrobble")} checked={settings.scrobble} onChange={(scrobble) => update({ scrobble })} />
      </Setting>
      <Setting title={tr("settings.remember")} hint={tr("settings.rememberHint")}>
        <Switch label={tr("settings.remember")} checked={settings.rememberQueue} onChange={(rememberQueue) => update({ rememberQueue })} />
      </Setting>
      <Setting title={tr("settings.shortcuts")} hint={tr("settings.shortcutsHint")}>
        <span />
      </Setting>
      <ul className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.action}>
            <span>{tr(shortcut.label)}</span>
            <span className="shortcut-keys">
              {shortcut.keys.map((key, i) => (
                <span key={key}>{i > 0 && " + "}<kbd>{key === "Space" ? tr("settings.space") : key}</kbd></span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <h2>{tr("settings.windows")}</h2>
      {desktop ? (
        <>
          <Setting title={tr("settings.tray")} hint={tr("settings.trayHint")}>
            {windowPrefs ? (
              <Switch label={tr("settings.tray")} checked={windowPrefs.closeToTray} disabled={busy} onChange={(closeToTray) => void change(() => setCloseToTray(closeToTray))} />
            ) : (
              <span className="muted">…</span>
            )}
          </Setting>
          <Setting title={tr("settings.mediaKeys")} hint={tr("settings.mediaKeysHint")}>
            {windowPrefs ? (
              <Switch label={tr("settings.mediaKeys")} checked={windowPrefs.globalShortcuts} disabled={busy} onChange={(globalShortcuts) => void change(() => setGlobalShortcuts(globalShortcuts))} />
            ) : (
              <span className="muted">…</span>
            )}
          </Setting>
          <Setting title={tr("settings.updates")} hint={updatePhase === "idle" ? describeUpdate(updateStatus) : describePhase(updatePhase, updateStatus?.version ?? null, updatePercent)}>
            {updateStatus?.state === "available" && updatePhase === "idle" ? (
              <button type="button" onClick={() => void fetchUpdate()} disabled={busy}>{tr("update.fetch", { version: updateStatus.version ?? "" })}</button>
            ) : updatePhase === "ready" || updatePhase === "installing" ? (
              <button type="button" onClick={() => void applyUpdate()} disabled={busy}>{tr("update.apply")}</button>
            ) : (
              <button type="button" className="ghost" onClick={() => void searchUpdate()} disabled={busy}>{tr("update.search")}</button>
            )}
          </Setting>
          {!hasTray && <p className="settings-note muted">{tr("settings.noTray")}</p>}
          {problem && <p className="form-error" role="alert"><CircleAlert size={18} /> {problem}</p>}
        </>
      ) : (
        <p className="muted">{tr("settings.desktopOnly")}</p>
      )}

      <h2>{tr("nav.offline")}</h2>
      {offlineSupported() ? (
        <>
          <Setting
            title={tr("settings.storage")}
            hint={`${tr("settings.storageUsed", { tracks: tr("count.tracks", { count: offlineCount }), size: formatBytes(usage ?? 0), measuring: offlineReady ? "" : tr("settings.measuring") })}${settings.offlineLimitGb > 0 ? tr("offline.ofLimit", { limit: settings.offlineLimitGb }) : ""}. ${tr("settings.storageHint")}`}
          >
            <button
              type="button"
              className="ghost"
              disabled={!offlineCount}
              onClick={() => { if (confirm(tr("settings.clearConfirm"))) void clearAll(); }}
            >
              {tr("settings.clearAll")}
            </button>
          </Setting>
          <Setting title={tr("settings.limit")} hint={tr("settings.limitHint")}>
            <Segmented label={tr("settings.limit")} value={settings.offlineLimitGb} options={limits} onChange={(offlineLimitGb) => update({ offlineLimitGb })} />
          </Setting>
        </>
      ) : (
        <p className="muted">{tr("settings.offlineAppOnly")}</p>
      )}

      <h2>{tr("settings.account")}</h2>
      <Setting title={creds?.username ?? tr("diag.notSignedIn")} hint={creds ? tr("settings.accountHint", { server: creds.serverUrl }) : tr("settings.signInPrompt")}>
        {creds && <button type="button" className="ghost" onClick={logout}><LogOut size={18} /> {tr("nav.logout")}</button>}
      </Setting>
      <Setting
        title={tr("settings.credentials")}
        hint={
          keychain === null
            ? tr("settings.keychainChecking")
            : keychain
              ? tr("settings.keychainOk")
              : tr("settings.keychainNone")
        }
      >
        <Link className="button-link ghost" to="/diagnostics"><Stethoscope size={18} /> {tr("settings.openDiagnostics")}</Link>
      </Setting>

      <h2>{tr("settings.profiles")}</h2>
      {profileProblem && <p className="form-error" role="alert"><CircleAlert size={18} /> {profileProblem}</p>}
      {profiles.length ? (
        <ul className="profile-list">
          {profiles.map((profile) => {
            const active = profileId(profile) === activeProfile;
            return (
              <li key={profileId(profile)} className={active ? "profile active" : "profile"}>
                <UserRound size={20} aria-hidden="true" />
                <div className="profile-text">
                  <strong>{profile.username}</strong>
                  <span className="muted">{profile.serverUrl}</span>
                </div>
                {active && <span className="badge">{tr("settings.active")}</span>}
                {!active && (
                  <button type="button" className="ghost" disabled={profileBusy} onClick={() => void switchProfile(profile)} aria-label={tr("settings.switchTo", { user: profile.username, server: profile.serverUrl })}>
                    {tr("settings.switch")}
                  </button>
                )}
                <button
                  type="button"
                  className="ghost"
                  disabled={profileBusy}
                  onClick={() => { if (confirm(tr(active ? "settings.removeConfirmActive" : "settings.removeConfirm", { user: profile.username }))) void removeProfile(profile); }}
                  aria-label={tr("settings.removeProfile", { user: profile.username, server: profile.serverUrl })}
                >
                  {tr("queue.remove")}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">{tr("settings.noProfiles")}</p>
      )}
      <AddProfile />
    </section>
  );
}
