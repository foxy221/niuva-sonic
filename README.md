# Niuva Sonic

*A New World of Sound.* Musik-Client für [Navidrome](https://www.navidrome.org/) (Subsonic-API) für Windows und Android, eine gemeinsame Codebasis.

## Tech Stack

| Bereich | Wahl |
| --- | --- |
| App-Shell | Tauri 2 (Rust), Windows + Android aus einem Projekt |
| UI | React 19 + TypeScript, Vite |
| Server-State | TanStack Query |
| Client-State | Zustand |
| Routing | React Router |
| Netzwerk | `tauri-plugin-http` (Rust-Seite, kein CORS-Problem mit dem Navidrome-Server) |
| Persistenz | `tauri-plugin-store` |
| Paketmanager | pnpm |

## Entwicklung

```bash
pnpm install
pnpm test                 # Regressionstests für Sitzung, Bibliothek, Playlists, Player und Windows-Hülle
pnpm tauri dev            # Windows-Desktop
pnpm tauri android dev    # Android (Gerät/Emulator)
pnpm tauri build          # Release-Build (NSIS-Installer unter src-tauri/target/release/bundle/nsis)
```

Voraussetzungen: Node 24, pnpm, Rust (MSVC), WebView2. Für Android zusätzlich `JAVA_HOME` (JDK 21), `ANDROID_HOME` und `NDK_HOME` sowie die Rust-Android-Targets.

## Windows

- **Tray:** Linksklick holt das Fenster nach vorn, Rechtsklick öffnet das Menü mit Wiedergabe-Steuerung und Beenden.
- **Schließen:** Standard ist Beenden. In den Einstellungen lässt sich einschalten, dass das Fenster beim Schließen in den Tray wandert und die Wiedergabe weiterläuft.
- **Tastenkürzel:** Leertaste hält an und spielt weiter. Die Medientasten regelt Windows über die Media Session; wer sie zusätzlich systemweit abfangen will, schaltet das in den Einstellungen ein.
- **Fenster:** Größe, Position und maximierter Zustand werden gemerkt. Ein zweiter Start holt das vorhandene Fenster nach vorn, statt ein zweites zu öffnen.
- **Updates:** vorbereitet, aber noch nicht eingerichtet (keine Update-Adresse hinterlegt). Die Schritte stehen in [docs/ROADMAP-Technik.md](docs/ROADMAP-Technik.md) unter Phase 3.


## Struktur

- `src/api/` Subsonic-Client und Typen
- `src/hooks/` Datenzugriff über TanStack Query (Bibliothek, Favoriten, Playlists)
- `src/state/` Zustand-Stores (Sitzung, Player)
- `src/components/` Bausteine und App-Rahmen
- `src/screens/` Ansichten
- `src-tauri/` Rust-Backend und Tauri-Konfiguration (`src/desktop.rs` Tray, Fenster, Medientasten)
- `src-tauri/gen/android/` generiertes Android-Projekt
- `branding/` Logos, `docs/` Notizen und Roadmaps

## Roadmap

- [Technik](docs/ROADMAP-Technik.md): API, Wiedergabe, Windows-Integration, Android, Offline, Qualität. Die Phasen 1 (Bibliothek), 2 (Wiedergabe) und 3 (Windows) sind abgeschlossen.
- [Design](docs/ROADMAP-Design.md): Tokens, App-Rahmen, Bildschirme, Bewegung. Läuft parallel zur Technik.
