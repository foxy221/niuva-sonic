import { bitRateOptions, formatOptions, useSettings, type PlaybackSettings } from "../state/settings";
import { useSession } from "../state/session";

const bitRateLabel = (value: number) => (value === 0 ? "Original" : `${value} kbit/s`);
const formatLabel = (value: string) => (value === "" ? "Originalformat" : value.toUpperCase());

/** Einstellungen zur Wiedergabe. Roh gebaut: Überschrift, Auswahlfelder, Hinweise. */
export default function Settings() {
  const { settings, update } = useSettings();
  const creds = useSession((s) => s.creds);

  return (
    <section className="settings">
      <h1>Einstellungen</h1>

      <h2>Wiedergabe</h2>
      <div className="filters">
        <label>
          Maximale Bitrate
          <select value={settings.maxBitRate} onChange={(e) => update({ maxBitRate: Number(e.target.value) })}>
            {bitRateOptions.map((value) => (
              <option key={value} value={value}>{bitRateLabel(value)}</option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select value={settings.format} onChange={(e) => update({ format: e.target.value })}>
            {formatOptions.map((value) => (
              <option key={value || "original"} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
        </label>
        <label>
          ReplayGain
          <select value={settings.replayGain} onChange={(e) => update({ replayGain: e.target.value as PlaybackSettings["replayGain"] })}>
            <option value="off">Aus</option>
            <option value="track">Titel</option>
            <option value="album">Album</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Bitrate und Format gelten sofort, auch für den laufenden Titel: der Server liefert die Datei dann umgerechnet.
        Springen funktioniert auch dabei. ReplayGain wirkt nur bei Titeln, die entsprechende Werte in den Tags tragen.
      </p>

      <h2>Verhalten</h2>
      <div className="filters">
        <label>
          <input type="checkbox" checked={settings.gapless} onChange={(e) => update({ gapless: e.target.checked })} />
          Nächsten Titel vorladen (ohne Ladepause)
        </label>
        <label>
          <input type="checkbox" checked={settings.scrobble} onChange={(e) => update({ scrobble: e.target.checked })} />
          Wiedergaben an den Server melden
        </label>
        <label>
          <input type="checkbox" checked={settings.rememberQueue} onChange={(e) => update({ rememberQueue: e.target.checked })} />
          Warteschlange beim Beenden merken
        </label>
      </div>
      <p className="muted">
        Gemeldet wird nach der üblichen Regel: mindestens 30 Sekunden und die halbe Länge oder vier Minuten.
        Beim Beenden merkt sich die App Warteschlange, Titel und Position.
      </p>

      <h2>Server</h2>
      <p className="muted">{creds ? `${creds.serverUrl} · ${creds.username}` : "Nicht angemeldet."}</p>
      <p className="muted">Das Passwort wird nicht gespeichert, die Anmeldung läuft über Token und Salt.</p>
    </section>
  );
}
