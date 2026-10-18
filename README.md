<div align="center">

<img src="branding/banner.png" alt="Niuva Sonic" width="640">

**A New World of Sound.**
Ein moderner Desktop-Client für deine eigene Musiksammlung, gebaut für [Navidrome](https://www.navidrome.org/) und die Subsonic-API.

[![Lizenz: Apache-2.0](https://img.shields.io/badge/Lizenz-Apache--2.0-blue.svg)](LICENSE)
![Plattform: Windows](https://img.shields.io/badge/Plattform-Windows-0078D4.svg)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)
![Status: in Entwicklung](https://img.shields.io/badge/Status-in%20Entwicklung-orange.svg)

</div>

---

## Was ist Niuva Sonic?

Niuva Sonic spielt die Musik von deinem eigenen Server ab: ohne Abo, ohne Werbung, ohne Cloud eines Dritten. Du verbindest die App mit deiner Navidrome-Instanz (oder einem anderen Subsonic-kompatiblen Server) und bekommst eine schnelle, aufgeräumte Oberfläche für deine Bibliothek.

> **Status:** Die App ist noch nicht veröffentlicht. Die Grundlagen stehen und werden gegen einen echten Navidrome-Server geprüft. Der erste Release für Windows ist in Vorbereitung.

## Funktionen

**Bibliothek**
- Künstler, Alben, Genres und Playlists durchstöbern
- Suche über die ganze Sammlung
- Favoriten pflegen, Playlists anlegen und umsortieren

**Wiedergabe**
- Warteschlange mit Umsortieren, Shuffle und Wiederholen
- Vollbild-Player mit Visualizer
- Einstellbare Streaming-Qualität (Format und Bitrate), ReplayGain, Vorladen des nächsten Titels
- Scrobbling zum Server und Merken der Warteschlange

**Offline**
- Alben für die Wiedergabe ohne Verbindung herunterladen
- Eigene Offline-Bibliothek mit Speicherverwaltung

**Windows-Integration**
- Tray-Symbol mit Wiedergabe-Steuerung, Schließen legt das Fenster in den Tray
- Medientasten und System-Overlay über die Windows-Mediensteuerung
- Fenstergröße und -position werden gemerkt, eine zweite Instanz holt das vorhandene Fenster nach vorn
- Installer ohne Administratorrechte

**Datenschutz**
- Dein Passwort wird nicht gespeichert. Die Anmeldung läuft über Token und Salt der Subsonic-API.
- Token und Salt liegen im Schlüsselbund von Windows (Anmeldeinformationsverwaltung), nicht in einer Datei der App.
- Die App spricht ausschließlich mit dem Server, den du angibst.

**Mehrere Server und Betrieb**
- Mehrere Server-Profile zum Umschalten; je Profil liegen die Zugangsdaten im Schlüsselbund
- Diagnoseansicht mit Verbindungsprüfung, gemeldeten Serverfähigkeiten und Protokoll
- Fehlerprotokoll in einer Datei (`niuva-sonic.log` im Protokollordner der App)

## Installation

Sobald es einen Release gibt, findest du den Installer unter [Releases](https://github.com/foxy221/niuva-sonic/releases). Bis dahin kannst du die App selbst bauen (siehe unten).

Voraussetzung: Windows 10 oder 11 mit WebView2 (ist in Windows 11 enthalten) und ein erreichbarer Navidrome- oder Subsonic-Server.

## Selbst bauen

Voraussetzungen: [Node.js](https://nodejs.org/) 24, [pnpm](https://pnpm.io/), [Rust](https://www.rust-lang.org/tools/install) (MSVC-Toolchain) und WebView2.

```bash
pnpm install
pnpm test          # Regressionstests für Sitzung, Bibliothek, Playlists, Player, Offline und Windows-Hülle
pnpm typecheck     # TypeScript ohne Ausgabe prüfen
pnpm e2e           # End-to-End gegen den eigenen Server (liest zugangsdaten.txt, ändert nichts)
pnpm tauri dev     # Entwicklungsmodus
pnpm tauri build   # Release-Build, Installer unter src-tauri/target/release/bundle/nsis
```

Für `pnpm e2e` liegt neben dem Projekt eine `zugangsdaten.txt` mit Serveradresse,
Benutzername und Passwort (eine Angabe je Zeile). Der Lauf prüft Anmeldung,
Bibliothek, ein Album und das Abspielen eines Titels; er verändert keine Daten
auf dem Server.

## Technik

| Bereich | Wahl |
| --- | --- |
| App-Shell | [Tauri 2](https://tauri.app/) (Rust) |
| Oberfläche | React 19, TypeScript, Vite |
| Server-Daten | TanStack Query |
| App-Zustand | Zustand |
| Routing | React Router |
| Netzwerk | `tauri-plugin-http` (läuft auf der Rust-Seite, daher kein CORS-Problem mit dem Server) |
| Ablage | `tauri-plugin-store`, Zugangsdaten im Windows-Schlüsselbund (`keyring`) |
| Tests | Vitest, `cargo test`, End-to-End gegen den Testserver (`pnpm e2e`) |

```
src/api/          Subsonic-Client und Typen
src/hooks/        Datenzugriff über TanStack Query
src/state/        Stores für Sitzung, Player, Einstellungen, Offline, Profile und Fähigkeiten
src/components/   Bausteine und App-Rahmen
src/screens/      Ansichten (u. a. Einstellungen und Diagnose)
src-tauri/        Rust-Hülle (Tray, Fenster, Medientasten, Updater, Schlüsselbund, Protokoll)
scripts/          End-to-End-Lauf gegen den Testserver
branding/         Logos
```

## Wie die App entstanden ist

Uns ist Transparenz wichtig, deshalb hier offen, was von wem kommt:

- **Idee und Name** von Niuva Sonic sind rein menschlich. Die Herkunft des Namens steht in [docs/Name-und-Bedeutung.md](docs/Name-und-Bedeutung.md).
- **Der Code** entsteht menschlich mit KI-Unterstützung. Konzept, Entscheidungen und Prüfung liegen beim Menschen, die KI hilft beim Schreiben und Review.
- **Die Logos** wurden mit generativer KI erstellt und anschließend von Hand nachbearbeitet.

## Mitmachen

Fehler, Wünsche und Ideen sind willkommen: Eröffne gern ein [Issue](https://github.com/foxy221/niuva-sonic/issues). Bitte gib dabei deine Windows-Version und die Version deines Servers an, wenn es um Verbindungsprobleme geht.

## Lizenz

Der Quellcode steht unter der [Apache License 2.0](LICENSE). Name, Logos und Bildmarke „Niuva Sonic“ sind davon ausgenommen und dürfen nicht ohne Zustimmung für andere Projekte verwendet werden.

Niuva Sonic ist ein unabhängiges Projekt und steht in keiner Verbindung zu Navidrome oder dem Subsonic-Projekt.
