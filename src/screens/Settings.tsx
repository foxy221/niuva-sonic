import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import Segmented from "../components/Segmented";
import Switch from "../components/Switch";
import { formatBytes } from "../format";
import { replayGainSupported, useCapabilities } from "../state/capabilities";
import {
  checkForUpdate,
  isDesktopApp,
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
import { useSession } from "../state/session";

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

const bitRates = bitRateOptions.map((value) => ({ value, label: value === 0 ? "Original" : String(value) }));
const formats = formatOptions.map((value) => ({ value, label: value === "" ? "Original" : value.toUpperCase() }));
const limits = limitOptions.map((value) => ({ value, label: value === 0 ? "Unbegrenzt" : `${value} GB` }));
const gains: { value: PlaybackSettings["replayGain"]; label: string }[] = [
  { value: "off", label: "Aus" },
  { value: "track", label: "Pro Titel" },
  { value: "album", label: "Pro Album" },
];

/** Zustandstext der Update-Prüfung. */
export function describeUpdate(status: UpdateStatus | null): string {
  if (!status) return "Noch nicht geprüft.";
  if (status.state === "notConfigured") return `Version ${status.currentVersion}. Auto-Update ist noch nicht eingerichtet.`;
  if (status.state === "upToDate") return `Version ${status.currentVersion} ist aktuell.`;
  if (status.state === "available") return `Version ${status.version} steht bereit (installiert: ${status.currentVersion}).`;
  return `Die Prüfung ist fehlgeschlagen: ${status.message}`;
}

export default function Settings() {
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
      .catch(() => { if (!cancelled) setProblem("Die Windows-Einstellungen konnten nicht gelesen werden."); });
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
      setProblem(typeof error === "string" ? error : "Die Änderung wurde nicht übernommen.");
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
      if (request === updateRequest.current) setUpdateStatus(status);
    } catch {
      setProblem("Die Update-Prüfung ist fehlgeschlagen.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="settings">
      <h1>Einstellungen</h1>

      <h2>Klang</h2>
      <Setting title="Streaming-Qualität" hint="Höchste Bitrate in kbit/s. Niedrigere Werte sparen mobile Daten. Gilt sofort, auch für den laufenden Titel.">
        <Segmented label="Streaming-Qualität" value={settings.maxBitRate} options={bitRates} onChange={(maxBitRate) => update({ maxBitRate })} />
      </Setting>
      <Setting title="Audioformat" hint="Der Server rechnet die Datei dafür um. Original lässt sie unverändert.">
        <Segmented label="Audioformat" value={settings.format} options={formats} onChange={(format) => update({ format })} />
      </Setting>
      <Setting
        title="Lautstärke angleichen"
        hint={
          replayGainSupported(server)
            ? "Gleicht laute und leise Aufnahmen an. Wirkt nur bei Titeln, die ReplayGain-Werte in den Tags tragen."
            : capabilitiesReady
              ? "Der Server meldet keine OpenSubsonic-Erweiterungen und liefert damit keine ReplayGain-Werte. Die Auswahl bleibt hier ohne Wirkung."
              : "Es wird noch geprüft, ob der Server ReplayGain-Werte liefert."
        }
      >
        <Segmented label="Lautstärke angleichen" value={settings.replayGain} options={gains} disabled={!replayGainSupported(server)} onChange={(replayGain) => update({ replayGain })} />
      </Setting>

      <h2>Wiedergabe</h2>
      <Setting title="Nahtlose Übergänge" hint="Lädt den nächsten Titel schon vor, damit zwischen zwei Titeln nichts stockt.">
        <Switch label="Nahtlose Übergänge" checked={settings.gapless} onChange={(gapless) => update({ gapless })} />
      </Setting>
      <Setting title="Wiedergaben melden" hint="Navidrome zählt mit, was du hörst: ab 30 Sekunden und der halben Länge, spätestens nach vier Minuten.">
        <Switch label="Wiedergaben melden" checked={settings.scrobble} onChange={(scrobble) => update({ scrobble })} />
      </Setting>
      <Setting title="Warteschlange merken" hint="Beim nächsten Start geht es mit Titel und Position weiter, wo du aufgehört hast.">
        <Switch label="Warteschlange merken" checked={settings.rememberQueue} onChange={(rememberQueue) => update({ rememberQueue })} />
      </Setting>
      <Setting title="Tastenkürzel" hint="Leertaste hält die Wiedergabe an und setzt sie fort – außer in Eingabefeldern.">
        <span className="muted">Leertaste</span>
      </Setting>

      <h2>Windows</h2>
      {desktop ? (
        <>
          <Setting title="Beim Schließen in den Tray" hint="Das Fenster verschwindet, die Wiedergabe läuft weiter. Linksklick auf das Tray-Symbol holt es zurück, „Beenden“ im Menü schließt die App. Windows 11 legt neue Symbole zuerst in den ausgeblendeten Bereich neben der Uhr.">
            {windowPrefs ? (
              <Switch label="Beim Schließen in den Tray" checked={windowPrefs.closeToTray} disabled={busy} onChange={(closeToTray) => void change(() => setCloseToTray(closeToTray))} />
            ) : (
              <span className="muted">…</span>
            )}
          </Setting>
          <Setting title="Medientasten abfangen" hint="Windows regelt die Medientasten normalerweise über die Media Session. Nur einschalten, wenn das nicht greift.">
            {windowPrefs ? (
              <Switch label="Medientasten abfangen" checked={windowPrefs.globalShortcuts} disabled={busy} onChange={(globalShortcuts) => void change(() => setGlobalShortcuts(globalShortcuts))} />
            ) : (
              <span className="muted">…</span>
            )}
          </Setting>
          <Setting title="Updates" hint={describeUpdate(updateStatus)}>
            <button type="button" className="ghost" onClick={() => void searchUpdate()} disabled={busy}>Nach Updates suchen</button>
          </Setting>
          {!hasTray && <p className="muted">Das Tray-Symbol konnte nicht angelegt werden. Schließen beendet die App dann normal, damit sie nicht unsichtbar weiterläuft.</p>}
          {problem && <p className="muted">{problem}</p>}
        </>
      ) : (
        <p className="muted">Tray-Symbol, Medientasten und Update-Prüfung gibt es nur in der installierten App.</p>
      )}

      <h2>Offline</h2>
      {offlineSupported() ? (
        <>
          <Setting
            title="Offline-Ablage"
            hint={`${offlineCount} Titel, ${formatBytes(usage ?? 0)}${offlineReady ? "" : " werden gemessen"}${settings.offlineLimitGb > 0 ? ` von ${settings.offlineLimitGb} GB` : ""}. Heruntergeladene Titel spielen ohne Serververbindung.`}
          >
            <button
              type="button"
              className="ghost"
              disabled={!offlineCount}
              onClick={() => { if (confirm("Die komplette Offline-Ablage löschen? Heruntergeladene Titel werden entfernt.")) void clearAll(); }}
            >
              Alles entfernen
            </button>
          </Setting>
          <Setting title="Speicherlimit" hint="Neue Downloads halten an, wenn die Ablage das Limit erreicht. Bereits heruntergeladene Titel bleiben.">
            <Segmented label="Speicherlimit" value={settings.offlineLimitGb} options={limits} onChange={(offlineLimitGb) => update({ offlineLimitGb })} />
          </Setting>
        </>
      ) : (
        <p className="muted">Downloads und Offline-Wiedergabe gibt es nur in der installierten App.</p>
      )}

      <h2>Konto</h2>
      <Setting title={creds?.username ?? "Nicht angemeldet"} hint={creds ? `${creds.serverUrl}. Dein Passwort wird nicht gespeichert, die Anmeldung läuft über einen Token.` : "Melde dich an, um deine Musik zu hören."}>
        {creds && <button type="button" className="ghost" onClick={logout}><LogOut size={18} /> Abmelden</button>}
      </Setting>
      <Setting
        title="Zugangsdaten"
        hint={
          keychain === null
            ? "Der Schlüsselbund wird geprüft …"
            : keychain
              ? "Token und Salt liegen im Schlüsselbund von Windows, nicht in der Datei der App. Passwörter werden nie gespeichert."
              : "Kein Schlüsselbund verfügbar. In der App gilt die Anmeldung dann nur für diese Sitzung; in der Entwicklung im Browser liegt sie in der lokalen Ablage."
        }
      >
        <a className="ghost" href="#/diagnostics">Diagnose öffnen</a>
      </Setting>
      {profileProblem && <p className="muted">{profileProblem}</p>}
      <h2>Server-Profile</h2>
      {profiles.length ? (
        <ul>
          {profiles.map((profile) => (
            <li key={profileId(profile)}>
              <span>{profile.username} <span className="muted">{profile.serverUrl}</span></span>{" "}
              <button
                type="button"
                className="ghost"
                disabled={profileBusy || profileId(profile) === activeProfile}
                onClick={() => void switchProfile(profile)}
              >
                {profileId(profile) === activeProfile ? "Aktiv" : "Wechseln"}
              </button>{" "}
              <button type="button" className="ghost" disabled={profileBusy} onClick={() => void removeProfile(profile)}>Entfernen</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Noch kein Server gemerkt. Nach der ersten Anmeldung erscheint er hier zum Umschalten.</p>
      )}
    </section>
  );
}
