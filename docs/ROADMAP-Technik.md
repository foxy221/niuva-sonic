# Roadmap Technik

Für die Agenten, die die technische Umsetzung übernehmen (Codex, Cline). Das Layout und die visuelle Gestaltung stehen in [ROADMAP-Design.md](ROADMAP-Design.md) und werden separat gemacht.

**Stand:** Phase 1 (Bibliothek) und Phase 2 (Wiedergabe) sind abgeschlossen, der Code ist gepusht und gegen den Testserver geprüft. Nächste Phase: Windows-Integration (Medientasten, Fenster, Installer).

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

- [x] `getArtist` + Künstlerseite (Alben, `getArtistInfo2` für Bio und ähnliche Künstler)
- [x] Künstlerliste (`getArtists`) und Albumliste mit Sortierung und Paginierung (`getAlbumList2`, `offset`)
- [x] Genres (`getGenres`, `getSongsByGenre`)
- [x] Favoriten: `star`, `unstar`, `getStarred2`, Herz an Titeln, Alben, Künstlern
- [x] Playlists: `getPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`
- [x] Suche: `search3` mit Entprellung, getrennt nach Künstlern, Alben, Titeln
- [x] Zuletzt gespielt, Meistgespielt, Zufällig als Startseiten-Abschnitte (`getAlbumList2` Typen)

Fertig, wenn: jede Ansicht Ladezustand, Leerzustand und Fehlerzustand liefert und Daten über TanStack Query gecacht werden.

### Stand der Umsetzung (Technik, abgeschlossen)

- **API:** `src/api/subsonic.ts` deckt jetzt `getArtists`, `getArtist`, `getArtistInfo2`, `getAlbumList2` (mit `fromYear`, `toYear`, `genre`), `getAlbum`, `getGenres`, `getSongsByGenre`, `getRandomSongs`, `getStarred2`, `star`, `unstar`, `getPlaylists`, `getPlaylist`, `createPlaylist`, `updatePlaylist`, `deletePlaylist` und `search3` ab. Mehrfachwerte (z. B. `id` bei `star`) laufen als wiederholte Parameter.
- **Hooks:** neu unter `src/hooks/` – `keys.ts` (Query-Schlüssel), `useClient.ts`, `library.ts` (alle Lese-Abfragen), `favorites.ts` (Favoriten), `playlists.ts` (Playlists), `useDebouncedValue.ts` (Suche).
- **Ansichten:** Start (vier Abschnitte), Suche, Künstlerliste, Künstlerseite, Albenliste (Sortierung und Seiten), Album, Genres, Genre, Favoriten, Playlists, Playlist-Detail.
- **Technik-Bausteine in `src/components/`** (nur Funktion, Optik folgt): `QueryStates` (Laden/Leer/Fehler), `Pager`, `AlbumGrid`, `ArtistGrid`, `SongList`, `FavoriteButton`, `AddToPlaylist`, `AlbumSection`.
- **Provisorium:** die letzten Regeln in `src/styles.css` (`.topbar-nav`, `.filters`, `.pager`, `.track-row`, `.song-actions`, `.playlist-edit`, …) sind reines Layout, damit die Bausteine bedienbar sind. Design ersetzt sie beim Aufteilen der Datei. Herz und „Entfernen“ sind Textzeichen, `lucide-react` kommt vom Design.
- **Gegen den Testserver geprüft:** Navidrome 0.64.2 (10114574), OpenSubsonic. `createPlaylist` liefert dort das `playlist`-Element zurück, `getPlaylist` die Titel als `entry`, serverseitig erzeugte Playlists tragen `readonly` und werden in der Oberfläche nicht zum Ändern angeboten.
- **Offen aus Phase 1 herausgenommen:** „Beliebteste Titel“ auf der Künstlerseite. `getTopSongs` liefert auf Navidrome ohne Last.fm-Anbindung nichts (geprüft), deshalb fehlt der Abschnitt bewusst.


## Phase 2: Wiedergabe

- [x] Queue-Verwaltung: Titel anhängen, als Nächstes spielen, entfernen, umsortieren, Queue leeren
- [x] Shuffle und Wiederholen (aus, Queue, Titel)
- [x] Queue und Position über Neustart erhalten
- [x] Scrobbling: `scrobble` bei Start und Ende, damit Navidrome Wiedergaben zählt
- [x] Gapless-Wiedergabe: nächsten Titel vorladen (zweites Audio-Element oder Web Audio)
- [x] Transcoding-Option (`maxBitRate`, `format`) für mobile Daten
- [x] ReplayGain aus den Tags anwenden
- [x] Fehlerbehandlung: Stream bricht ab, Titel nicht abspielbar, Netzwechsel

### Stand der Umsetzung (Technik, Phase 2, abgeschlossen)

- **API:** `streamUrl(id, { maxBitRate, format })` und `scrobble({ id, submission, time })` in `src/api/subsonic.ts`; Typen `ReplayGain`, `StreamOptions` und die Felder `playCount`, `played`, `replayGain` in `src/api/types.ts`.
- **Player-Kern:** `src/state/player.ts` verwaltet die Warteschlange (`playQueue`, `jumpTo`, `appendToQueue`, `playNext`, `removeFromQueue`, `moveInQueue`, `clearQueue`), Shuffle und Wiederholen, Scrobbling, Persistenz und Fehlerzustände. Reine Rechenlogik liegt in `src/state/player.logic.ts`, die zwei Audio-Elemente in `src/state/audioEngine.ts`.
- **Zwei Audio-Elemente:** Das zweite lädt den nächsten Titel vor und übernimmt ihn beim Titelwechsel (`takePreloaded`). Damit fällt die Ladezeit über das Netz weg; samplegenau ist es nicht, dafür bräuchte es Web Audio mit dekodierten Puffern.
- **Scrobbling:** `submission=false` beim Start, `submission=true` nach der üblichen Regel (mindestens 30 s und halbe Länge oder vier Minuten). Gezählt wird nur echte Hörzeit: Sprünge durch Spulen zählen nicht mit. Abschaltbar in den Einstellungen.
- **Ablage:** `src/state/storage.ts` kapselt `plugin-store` (Tauri) und `localStorage` (Browser); `session.ts` nutzt sie jetzt ebenfalls. `src/state/settings.ts` hält Bitrate, Format, ReplayGain, Vorladen, Scrobbling und „Warteschlange merken“.
- **Warteschlange über den Neustart:** gespeichert werden Warteschlange, Index, Position, Shuffle (einschließlich ursprünglicher Reihenfolge) und Wiederholen – gebunden an Serveradresse und Benutzer, damit keine fremden Titel-IDs übernommen werden. Beim Start läuft nichts von allein los. Alte Queues ohne Benutzerbindung werden verworfen.
- **Einstellungen:** neue Seite `#/settings` (Bitrate, Format, ReplayGain, Verhalten, Serveranzeige). Roh gebaut, Design gestaltet sie.
- **Gegen den Testserver geprüft:** Transcoding greift (3,1 MB → 1,5 MB bei `maxBitRate=64`), `format` ändert den Inhaltstyp (`opus` → `audio/ogg`, `aac` → `audio/aac`). Bereichsanfragen beantwortet Navidrome auch bei Transcoding mit HTTP 206, Springen funktioniert deshalb ohne Sonderweg; `transcodeOffset` braucht es nicht. `scrobble` zählt (`playCount` 0 → 1). `savePlayQueue`/`getPlayQueue` arbeiten (Position in Millisekunden) – die Warteschlange auf dem Server bleibt der Ideen-Phase vorbehalten, der Testserver wurde danach wieder geleert.
- **ReplayGain:** Die Felder kommen an (`trackGain`, `albumGain`, `trackPeak`, `albumPeak`, `baseGain`, `fallbackGain`), sind in der Testbibliothek aber leer – von 42 geprüften Titeln hatte keiner Werte. Die Rechnung (dB → Faktor, Peak als Obergrenze) ist deshalb durch Tests abgedeckt statt durch einen Hörversuch.
- **Tests:** `pnpm test` läuft mit 62 Tests durch (`tests/player.logic.test.js` für die Rechenlogik, `tests/player.test.js` für Warteschlange, Wiederholen, Scrobbling, Vorladen und Neustart). Zwei Fehler hat die Testrunde dabei gefunden: ein wirkungsloser `readyState`-Vergleich beim Übernehmen des vorgeladenen Titels und fehlende Test-Ausgangswerte für Zufall und Wiederholen.
- **Review vom 18.10.2026:** Fehler in Persistenz/Sitzungsgrenzen, Scrobbling, Fehlerwiederholung, Audio-Wechseln, Shuffle und Einstellungen behoben. Jetzt 88 erfolgreiche Tests; Befunde, Korrekturen und Prüfgrenzen stehen in [REVIEW-Phase-2.md](REVIEW-Phase-2.md).
- **Provisorium fürs Design:** `src/styles/glue.css` (Aktionen in der Warteschlange, Zeilenaktionen, Player-Hinweise, Einstellungsseite) ist reines Layout. Zufall und Wiederholen sitzen in `Transport`, die Warteschlangen-Aktionen im `QueuePanel`, „Als Nächstes“/„Anhängen“ je Zeile in `SongList`.

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
- [ ] Wiedergabe-Fortsetzung zwischen Geräten (`savePlayQueue`/`getPlayQueue`; gegen Navidrome geprüft: speichert Warteschlange und Position in Millisekunden, `indexBasedQueue` gibt es als Erweiterung)
- [ ] Radiosender und Podcasts, falls der Server sie anbietet

## Testserver

Zugangsdaten liegen lokal in `zugangsdaten.txt` (steht in `.gitignore`, nie committen). Der Testuser ist kein Admin und wird nach Abschluss entfernt.
