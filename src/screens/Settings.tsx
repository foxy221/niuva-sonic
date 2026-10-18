import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import Segmented from "../components/Segmented";
import Switch from "../components/Switch";
import { bitRateOptions, formatOptions, useSettings, type PlaybackSettings } from "../state/settings";
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
const gains: { value: PlaybackSettings["replayGain"]; label: string }[] = [
  { value: "off", label: "Aus" },
  { value: "track", label: "Pro Titel" },
  { value: "album", label: "Pro Album" },
];

export default function Settings() {
  const { settings, update } = useSettings();
  const { creds, logout } = useSession();

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
      <Setting title="Lautstärke angleichen" hint="Gleicht laute und leise Aufnahmen an. Wirkt nur bei Titeln, die ReplayGain-Werte in den Tags tragen.">
        <Segmented label="Lautstärke angleichen" value={settings.replayGain} options={gains} onChange={(replayGain) => update({ replayGain })} />
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

      <h2>Konto</h2>
      <Setting title={creds?.username ?? "Nicht angemeldet"} hint={creds ? `${creds.serverUrl}. Dein Passwort wird nicht gespeichert, die Anmeldung läuft über einen Token.` : "Melde dich an, um deine Musik zu hören."}>
        {creds && <button type="button" className="ghost" onClick={logout}><LogOut size={18} /> Abmelden</button>}
      </Setting>
    </section>
  );
}
