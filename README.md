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
pnpm test                 # Regressionstests für Sitzung, Bibliothek, Playlists und Player
pnpm tauri dev            # Windows-Desktop
pnpm tauri android dev    # Android (Gerät/Emulator)
pnpm tauri build          # Release-Build
```

Voraussetzungen: Node 24, pnpm, Rust (MSVC), WebView2. Für Android zusätzlich `JAVA_HOME` (JDK 21), `ANDROID_HOME` und `NDK_HOME` sowie die Rust-Android-Targets.

## Struktur

- `src/api/` Subsonic-Client und Typen
- `src/hooks/` Datenzugriff über TanStack Query (Bibliothek, Favoriten, Playlists)
- `src/state/` Zustand-Stores (Sitzung, Player)
- `src/components/` Bausteine und App-Rahmen
- `src/screens/` Ansichten
- `src-tauri/` Rust-Backend und Tauri-Konfiguration
- `src-tauri/gen/android/` generiertes Android-Projekt
- `branding/` Logos, `docs/` Notizen und Roadmaps

## Roadmap

- [Technik](docs/ROADMAP-Technik.md): API, Wiedergabe, Windows-Integration, Android, Offline, Qualität. Phase 1 (Bibliothek) und Phase 2 (Wiedergabe) sind abgeschlossen.
- [Design](docs/ROADMAP-Design.md): Tokens, App-Rahmen, Bildschirme, Bewegung. Läuft parallel zur Technik.
