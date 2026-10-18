# Roadmap Technik

Für die Agenten, die die technische Umsetzung übernehmen (Codex, Cline). Das Layout und die visuelle Gestaltung stehen in [ROADMAP-Design.md](ROADMAP-Design.md) und werden separat gemacht.

## Arbeitsteilung

- **Technik besitzt:** `src/api/`, `src/state/`, `src/hooks/` (neu), `src-tauri/`, Build, Tests, Android-Anbindung.
- **Design besitzt:** `src/styles.css` (wird aufgeteilt), `src/components/`, `src/screens/` (Markup und Optik).
- Wer Funktionen baut, legt sie als Store, Hook oder Tauri-Command ab und hängt sie **minimal** in die UI ein: semantisches HTML, bestehende Klassen, keine eigenen Farben, Abstände oder Icons. Das Design zieht die Optik danach nach.
- Ein Bildschirm, der neu entsteht, bekommt nur das Nötigste: Überschrift, Liste, Buttons. Gestaltung folgt später.
- Server-Zugriffe laufen ausschließlich über `SubsonicClient`. Komponenten rufen kein `fetch` direkt auf.

## Ausgangslage (Stand erledigt)

- [x] Tauri 2 + React 19 + TypeScript + Vite, pnpm
- [x] Android-Projekt generiert (`src-tauri/gen/android`), NDK 29, Rust-Targets
- [x] Subsonic-Client: `ping`, `getArtists`, `getAlbumList2`, `getAlbum`, `coverArtUrl`, `streamUrl`
- [x] Login mit Token+Salt (Passwort wird nicht gespeichert), Persistenz über `plugin-store`
- [x] Player-Store: Queue, Play/Pause, Vor/Zurück, Seek, Lautstärke, Media Session
- [x] Routing (HashRouter), Startseite, Album-Seite

## Phase 1: Bibliothek vollständig

- [ ] `getArtist` + Künstlerseite (Alben, `getArtistInfo2` für Bio und ähnliche Künstler)
- [ ] Künstlerliste (`getArtists`) und Albumliste mit Sortierung und Paginierung (`getAlbumList2`, `offset`)
- [ ] Genres (`getGenres`, `getSongsByGenre`)
- [ ] Favoriten: `star`, `unstar`, `getStarred2`, Herz an Titeln, Alben, Künstlern
- [ ] Playlists: `getPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`
- [ ] Suche: `search3` mit Entprellung, getrennt nach Künstlern, Alben, Titeln
- [ ] Zuletzt gespielt, Meistgespielt, Zufällig als Startseiten-Abschnitte (`getAlbumList2` Typen)

Fertig, wenn: jede Ansicht Ladezustand, Leerzustand und Fehlerzustand liefert und Daten über TanStack Query gecacht werden.

## Phase 2: Wiedergabe

- [ ] Queue-Verwaltung: Titel anhängen, als Nächstes spielen, entfernen, umsortieren, Queue leeren
- [ ] Shuffle und Wiederholen (aus, Queue, Titel)
- [ ] Queue und Position über Neustart erhalten
- [ ] Scrobbling: `scrobble` bei Start und Ende, damit Navidrome Wiedergaben zählt
- [ ] Gapless-Wiedergabe: nächsten Titel vorladen (zweites Audio-Element oder Web Audio)
- [ ] Transcoding-Option (`maxBitRate`, `format`) für mobile Daten
- [ ] ReplayGain aus den Tags anwenden
- [ ] Fehlerbehandlung: Stream bricht ab, Titel nicht abspielbar, Netzwechsel

## Phase 3: Windows-Integration

- [ ] Medientasten und System-Overlay testen (Media Session in WebView2)
- [ ] Single-Instance, Fenstergröße und -position merken
- [ ] Tray-Icon, Schließen minimiert optional in den Tray
- [ ] Globale Tastenkürzel (Leertaste im Fenster, optional global)
- [ ] Installer (`tauri build`, NSIS), Signierung klären
- [ ] Auto-Update (`tauri-plugin-updater`) vorbereiten

## Phase 4: Android

- [ ] `pnpm tauri android dev` auf Emulator und echtem Gerät lauffähig
- [ ] **Hintergrundwiedergabe**: natives Plugin mit Foreground-Service und `MediaSession`/Media3, Benachrichtigung mit Steuerung, Sperrbildschirm
- [ ] Audio-Fokus (Anruf, andere Apps) und Kopfhörer-Events
- [ ] Zurück-Taste und Systemleisten (Insets) sauber behandeln
- [ ] Release-Build, Signierung (Keystore **nicht** ins Repo)
- [ ] Gemeinsame Logik prüfen: kein Windows-Sonderweg im geteilten Code

Das ist die riskanteste Phase. Mit WebView-Audio allein stoppt die Wiedergabe, sobald die App in den Hintergrund geht.

## Phase 5: Offline

- [ ] Titel und Alben herunterladen (`download`), lokal ablegen
- [ ] Offline-Bibliothek und Wiedergabe aus dem lokalen Speicher
- [ ] Speicherverwaltung: Größe anzeigen, Cache leeren, Limit
- [ ] Metadaten-Cache (Bibliothek offline durchsuchbar)

## Phase 6: Qualität und Betrieb

- [ ] Zugangsdaten sicher ablegen (Betriebssystem-Schlüsselbund statt Klartext im Store)
- [ ] Unit-Tests für `SubsonicClient` (Vitest), Player-Store-Logik
- [ ] End-to-End-Test gegen den Testserver (Login, Album abspielen)
- [ ] CI (GitHub Actions): Typecheck, Tests, Windows-Build, Android-Build
- [ ] Fehlerprotokoll in Datei, Diagnoseansicht für Verbindungsprobleme
- [ ] Mehrere Server-Profile
- [ ] OpenSubsonic-Erweiterungen nutzen, wo der Server sie meldet (`getOpenSubsonicExtensions`, z. B. Lyrics, ReplayGain-Felder)

## Ideen mit Mehrwert gegenüber Spotify

Jeweils erst bewerten, dann einplanen:

- [ ] Synchronisierte Songtexte (`getLyricsBySongId`, OpenSubsonic)
- [ ] Equalizer und Crossfade
- [ ] Sleep-Timer
- [ ] Bibliothek nach Format, Bitrate, Jahr filtern (verlustfreie Dateien sichtbar machen)
- [ ] Mix aus der eigenen Bibliothek (`getSimilarSongs2`, `getRandomSongs`)
- [ ] Wiedergabe-Fortsetzung zwischen Geräten (`savePlayQueue`/`getPlayQueue`)
- [ ] Radiosender und Podcasts, falls der Server sie anbietet

## Testserver

Zugangsdaten liegen lokal in `zugangsdaten.txt` (steht in `.gitignore`, nie committen). Der Testuser ist kein Admin und wird nach Abschluss entfernt.
