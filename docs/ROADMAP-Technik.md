# Roadmap Technik

Für die Agenten, die die technische Umsetzung übernehmen (Codex, Cline). Das Layout und die visuelle Gestaltung stehen in [ROADMAP-Design.md](ROADMAP-Design.md) und werden separat gemacht.

**Stand:** Die Phasen 1 (Bibliothek), 2 (Wiedergabe), 3 (Windows-Integration) und 4 (Offline für Windows) sind abgeschlossen, der Code ist gepusht und gegen den Testserver geprüft. Medientasten und System-Overlay wurden manuell geprüft (siehe Phase 3); die Signierung des Installers bleibt offen. Nächste Phase: Qualität, Sicherheit und Betrieb für Windows. Android beginnt erst nach der vollständigen Windows-Abnahme (Phase 6).

## Verbindliche Reihenfolge (18.10.2026)

1. Die abgeschlossenen Grundlagen aus Phase 1–3 bilden die Windows-Basis.
2. Phase 4 liefert Offline-Funktionen für Windows.
3. Phase 5 vervollständigt Qualität, Sicherheit und Betrieb für Windows; parallel werden die offenen Windows-Aufgaben der [Design-Roadmap](ROADMAP-Design.md) abgeschlossen.
4. Phase 6 schließt Veröffentlichung und gemeinsame Windows-Abnahme ab.
5. Erst danach beginnt Phase 7 mit Android, einschließlich mobiler Gestaltung und Geräteprüfungen.

Bestehende Android-Vorbereitung bleibt erhalten. Neue Android-Funktionen, Android-Build-Pipelines und mobile Detailarbeit sind bis zur Windows-Abnahme zurückgestellt. Die gemeinsame Codebasis wird weiterhin plattformneutral gehalten. Die separat aufgeführten Ideen bleiben optionale Erweiterungen und sind keine Voraussetzung für die Windows-Abnahme.

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

- [x] Medientasten und System-Overlay testen (Media Session in WebView2) – von Hand geprüft: Vor, Zurück, Wiedergabe und Pause reagieren. Der Name in der Mediensteuerung bleibt „Unbekannte Anwendung“ (Grenze von WebView2, siehe unten)
- [x] Single-Instance, Fenstergröße und -position merken
- [x] Tray-Icon, Schließen minimiert optional in den Tray
- [x] Globale Tastenkürzel (Leertaste im Fenster, optional global)
- [x] Installer (`tauri build`, NSIS), Signierung klären
- [x] Auto-Update (`tauri-plugin-updater`) vorbereiten

### Stand der Umsetzung (Technik, Phase 3)

- **Rust-Seite:** `src-tauri/src/lib.rs` verdrahtet die Plugins, `src-tauri/src/desktop.rs` (nur Desktop) enthält Tray, Fensterverhalten, Medientasten und Update-Prüfung, `src-tauri/src/prefs.rs` legt die Hüllen-Einstellungen ab, `src-tauri/src/commands.rs` sind die Befehle für die Oberfläche.
- **Plugins:** `tauri-plugin-single-instance` (steht als erstes, holt bei einem zweiten Start das Fenster nach vorn), `tauri-plugin-window-state` (Größe, Position, maximiert), `tauri-plugin-global-shortcut` (Medientasten) und `tauri-plugin-updater`. Auf Android fehlen diese Bausteine; die Befehle sagen dort ab, damit die gemeinsame Oberfläche keinen Sonderweg braucht.
- **Tray:** Symbol aus `icons/32x32.png`, Linksklick holt das Fenster nach vorn, Rechtsklick öffnet das Menü (Fenster anzeigen, Wiedergabe/Pause, nächster und voriger Titel, Beenden). Die Wiedergabe-Befehle gehen als Ereignis `player-command` an die Oberfläche, damit es nur eine Quelle für die Player-Logik gibt.
- **Schließen:** Standard ist „in den Tray“: das Fenster verschwindet, die Wiedergabe läuft weiter; „Beenden“ im Tray-Menü schließt die App wirklich. Abschaltbar in den Einstellungen. Sicherung: Wurde das Tray-Symbol nicht angelegt, beendet Schließen die App wieder normal – sonst liefe sie unsichtbar weiter und wäre nicht mehr zu erreichen. Windows 11 legt neue Symbole zuerst in den ausgeblendeten Bereich neben der Uhr; das steht auch als Hinweis in den Einstellungen.
- **Name in der Mediensteuerung:** Windows zeigt „Unbekannte Anwendung“. Die Ursache liegt nicht in dieser App: Die Medien-Sitzung gehört dem WebView2-Prozess (`msedgewebview2.exe`), deshalb zeigt Windows dessen Identität an. Tauri verweist auf [tauri#13352](https://github.com/tauri-apps/tauri/issues/13352) und das Upstream-Issue [WebView2Feedback#2236](https://github.com/MicrosoftEdge/WebView2Feedback/issues/2236), wo Microsoft zuletzt „no update or work currently happening“ schreibt. Geprüft und verworfen: `SetCurrentProcessExplicitAppUserModelID`, ein Eintrag unter `HKCU\Software\Classes\AppUserModelId` und das Markieren des Fensters mit einer AppUserModelID – laut Erfahrungsberichten hilft das nur bei Benachrichtigungen, nicht in der Mediensteuerung. Das eigene EXE trägt einen korrekten Versionsdatensatz (`ProductName: Niuva Sonic`), der hier ebenfalls nicht greift. Bleibt offen, bis WebView2 nachzieht; ein eigener nativer Player (Media3 auf Android, Phase 7) umgeht das Problem.
- **Tastenkürzel:** Leertaste im Fenster hält an und spielt weiter, außer in Eingabefeldern und auf Knöpfen (`src/hooks/useKeyboardShortcuts.ts`). Optional fängt die Hülle zusätzlich die Medientasten systemweit ab (`set_global_shortcuts`); scheitert das Belegen, wird nichts halb belegt und die Oberfläche zeigt den Grund. Standardmäßig aus, weil Windows die Medientasten normalerweise schon über die Media Session regelt.
- **Einstellungen:** Abschnitt „Windows“ im Einstellungsbildschirm (Tray, Medientasten, Update-Prüfung) plus Hinweis auf die Leertaste.
- **Review vom 18.10.2026:** Geordnetes Beenden mit Speichern vor dem Prozessende, transaktionale Hüllen-Einstellungen, Listener-Abbau, Tastatur-/Android-Abgrenzung und Update-Status korrigiert. 112 Frontend- und 8 Rust-Tests bestehen. Befunde und Prüfgrenzen: [REVIEW-Phase-3.md](REVIEW-Phase-3.md).
- **Installer:** `bundle.targets` ist auf `nsis` gestellt (kein MSI/WiX), Installationsart `currentUser` (keine Admin-Rechte), Sprachen Deutsch und Englisch, dazu Herausgeber, Kurz- und Langbeschreibung für die Installer-Anzeige.
- **Auto-Update vorbereitet:** Der Plugin ist eingebunden, `plugins.updater` steht mit leerer Adressliste und leerem Schlüssel in der Konfiguration. Damit ist der Schalter da, aber es wird nichts geladen: Die Update-Prüfung meldet „noch nicht eingerichtet“, bis Adresse und öffentlicher Schlüssel eingetragen sind. Die Einrichtung braucht:
  1. `pnpm tauri signer generate -w ~/.tauri/niuva.key` (privater Schlüssel bleibt außerhalb des Repos),
  2. den öffentlichen Schlüssel in `plugins.updater.pubkey` eintragen,
  3. die Update-Adresse in `plugins.updater.endpoints` eintragen (HTTPS),
  4. `bundle.createUpdaterArtifacts` auf `true` setzen und beim Bauen `TAURI_SIGNING_PRIVATE_KEY` und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` setzen,
  5. eine Ablage für die Veröffentlichung (GitHub Releases oder eigener Server) festlegen.
  Das Herunterladen und Einspielen ist bewusst noch nicht verdrahtet: Das gehört zusammen mit der Veröffentlichung gemacht, sonst gibt es nichts zu installieren.
- **Signierung:** Noch offen und bewusst nicht vorweggenommen. Ohne Zertifikat (Authenticode) zeigt Windows beim Start des Installers eine Warnung. Nötig ist ein Code-Signing-Zertifikat; Alternativen sind ein OV/EV-Zertifikat vom Anbieter oder Azure Trusted Signing. Der Signaturschritt kommt über `bundle.windows.certificateThumbprint` bzw. `signCommand` dazu, sobald das Zertifikat da ist.
- **Prüfliste von Hand** (nicht automatisch prüfbar, weil sie eine echte Sitzung am Bildschirm braucht):
  - Medientasten: erledigt – Vor, Zurück, Wiedergabe und Pause reagieren, wenn das Fenster nicht im Vordergrund ist.
  - Mediensteuerung: Titel, Interpret und Cover stimmen; der Name der Anwendung bleibt systembedingt „Unbekannte Anwendung“ (siehe oben).
  - Tray: Symbol sichtbar (unter Windows 11 gegebenenfalls erst im ausgeblendeten Bereich neben der Uhr), Linksklick holt das Fenster, Rechtsklick-Menü steuert die Wiedergabe, „Beenden“ schließt die App.
  - Schließen: Fenster verschwindet, Wiedergabe läuft weiter, Fenster kommt per Tray zurück. Mit abgeschaltetem „Beim Schließen in den Tray“ beendet Schließen die App.
  - Leertaste: schaltet um, stört aber nicht in Suchfeld und Knöpfen.
  - Fenstergröße und -position nach einem Neustart.
  - Installer: Installation ohne Adminrechte, Eintrag im Startmenü, Deinstallation.
- **Automatisch geprüft:** `cargo test` (4 Tests für die Einstellungen der Hülle), `pnpm test` (96 Tests, darunter Leertaste, Hüllen-Befehle und Update-Text), Typecheck, Vite-Build und Release-Build mit NSIS-Installer. Dazu Starttests der gebauten Anwendung: Fenster wird erzeugt (Titel „Niuva Sonic“), das Tray-Symbol liegt wirklich vor (Fensterklasse `tray_icon_app` im laufenden Prozess), ein zweiter Start beendet sich mit Code 0 und lässt nur eine Instanz laufen, Schließen legt das Fenster in den Tray und der Prozess läuft weiter, und mit abgeschaltetem „Beim Schließen in den Tray“ beendet Schließen die App und schreibt `.window-state.json` mit Größe und Position.

## Phase 4: Offline für Windows

- [x] Titel und Alben herunterladen (`download`), lokal ablegen
- [x] Offline-Bibliothek und Wiedergabe aus dem lokalen Speicher
- [x] Speicherverwaltung: Größe anzeigen, Cache leeren, Limit
- [x] Metadaten-Cache (Bibliothek offline durchsuchbar)

Fertig, wenn: Downloads, Offline-Suche, lokale Wiedergabe und Speicherverwaltung in der Windows-App bedienbar sind und auch nach einem Neustart ohne Serververbindung funktionieren.

### Stand der Umsetzung (Technik, Phase 4, abgeschlossen)

- **Rust-Seite:** `src-tauri/src/offline.rs` lädt Dateien stückweise über den re-exportierten `reqwest` von `tauri-plugin-http` (Feature `stream`, dazu `futures-util` und `tokio` mit `fs`/`io-util`), schreibt sie unter `<AppData>/offline/` zuerst als `.part` und benennt sie erst nach vollständigem Download um – Abstürze und Abbrüche hinterlassen keine halben Titel, die wie vollständige aussehen. Dazu Befehle für Wurzelverzeichnis, Belegung messen (`.part` zählt nicht), einzelne Datei löschen und alles leeren. Relative Pfade der Oberfläche werden validiert (nur `[A-Za-z0-9._-]` und `/`; weist `..`, Laufwerkspfade und Trennzeichen anderer Plattformen ab).
- **Fortschritt und Abbruch:** Der laufende Download meldet alle 250 ms das Ereignis `download-progress` (Empfangen/Gesamt); `cancel_download` setzt ein Abbruch-Flag, verwirft die Teildatei und quittiert mit einer Fehlermeldung.
- **API:** `downloadUrl(id)` in `src/api/subsonic.ts` – `download` liefert die unveränderte Originaldatei, `stream` bleibt für die Wiedergabe. Gegen den Testserver geprüft: HTTP 206 auf Bereichsanfragen, Gesamtgröße stimmt exakt mit `song.size` überein (4.438.139 Bytes), `content-type: audio/mpeg`, `accept-ranges: bytes`.
- **Offline-Store:** `src/state/offline.ts` hält den Index (`offline.json` via plugin-store, ein Schlüssel pro Server-Benutzer-Kombination, beschädigte Einträge werden verworfen) und die Download-Jobs. Alben speichern Metadaten und Cover; Titel landen unter `<Serverkürzel>/<Titel-ID>.<Endung>`, Cover unter `<Serverkürzel>/covers/`. Jobs arbeiten die Titel der Reihe nach ab: bereits vorhandene werden übersprungen, ein fehlgeschlagener Titel stoppt die restlichen nicht, Abbruch behält die schon geladenen. Das Album-Cover darf fehlschlagen, ohne den Job zu scheitern.
- **Wiedergabe lokal:** `streamUrlFor` in `src/state/player.ts` nimmt die lokale Datei zuerst (schneller Start, kein Datenverkehr, läuft offline). Die WebView-Adresse liefert `convertFileSrc`; dafür ist das Asset-Protokoll mit Scope `$APPDATA/offline/**` in `tauri.conf.json` aktiviert (Cargo-Feature `protocol-asset`). Beim Wiederherstellen der Warteschlange läuft die Offline-Wiederherstellung vor dem ersten Laden, damit ein Start ohne Server nicht mit einem Ladefehler beginnt. Das Cover in der Mediensteuerung nimmt ebenfalls zuerst die lokale Datei. Scrobble-Aufrufe schlagen offline still fehl; die Wiedergabe läuft weiter.
- **Oberfläche:** Neuer Bildschirm `#/offline` (Belegung, laufende Downloads mit Fortschritt und Abbrechen, Suche durch die Offline-Bibliothek, Alben-Raster, einzelne Titel) und `#/offline/album/:id` (Album ganz ohne Server). Album-Seite: „Herunterladen“/„Offline entfernen“ mit laufendem Zähler; Titellisten: Zeilenaktion Download/Entfernen (nur in der App); Einstellungen: neuer Abschnitt „Offline“ mit Belegung, Speicherlimit (unbegrenzt/5/10/20/50 GB) und „Alles entfernen“.
- **Speicherlimit:** Wird vor jedem Titel geprüft (gemessene Belegung + Titelgröße gegen das Limit); erreicht, hält der Job mit Hinweis an. Bereits heruntergeladene Titel bleiben – automatisch etwas verdrängen, das der Nutzer ausdrücklich geladen hat, wäre überraschend.
- **Provisorium fürs Design:** `src/styles/offline.css` ist reines Layout für Jobliste und Suche. Design gestaltet es; die Funktionsmarkups nutzen bestehende Klassen (`album-grid`, `track-row`, `song-actions`, `setting`).
- **Tests:** `pnpm test` läuft mit 126 Tests durch (14 neue in `tests/offline.test.js`: Index/Wiederherstellung, Download-Lauf, Überspringen, Teilfehler, Gesamtfehler, Abbruch, Limit, Entfernen, lokale Wiedergabe, Einstellungsprüfung). `cargo test` besteht mit 11 Rust-Tests (drei neue zur Pfad-Validierung und Job-Anmeldung). Typecheck und Vite-Build laufen.
- **Prüfgrenzen:** Das Zusammenspiel mit der Mediensteuerung (lokales Cover im Overlay), das Spulen in lokalen Dateien über das Asset-Protokoll und der Offline-Start nach Windows-Neustart sind nur im Code bzw. durch Tests abgedeckt und gehören in die manuelle Abnahme (Phase 6). Der Release-Build mit NSIS-Installer wurde gefahren (4,20 MiB) und die gebaute Anwendung kurz gestartet: Fenster „Niuva Sonic“ wird erzeugt, Beenden schließt den Prozess.
- **Android-Vorbereitung:** Die Befehle sind plattformneutral gehalten (keine `desktop`-Beschränkung); Anpassen und Prüfen der Offline-Funktionen bleibt wie geplant Aufgabe von Phase 7.

## Phase 5: Qualität und Betrieb für Windows

- [ ] Zugangsdaten sicher ablegen (Betriebssystem-Schlüsselbund statt Klartext im Store)
- [ ] Testabdeckung für `SubsonicClient` und Player-Store vervollständigen; vorhandene Regressionstests erhalten
- [ ] End-to-End-Test gegen den Testserver (Login, Album abspielen), Offline-Abläufe zusätzlich ohne Verbindung prüfen
- [ ] CI (GitHub Actions): Typecheck, Tests, Windows-Build
- [ ] Fehlerprotokoll in Datei, Diagnoseansicht für Verbindungsprobleme
- [ ] Mehrere Server-Profile
- [ ] OpenSubsonic-Erweiterungen erkennen und bereits unterstützte Funktionen entsprechend den gemeldeten Fähigkeiten nutzen (`getOpenSubsonicExtensions`, z. B. ReplayGain-Felder); zusätzliche Funktionen wie Songtexte bleiben im Ideen-Backlog
- [ ] Offene Windows-Gestaltung und Barrierefreiheit aus der [Design-Roadmap](ROADMAP-Design.md) abschließen

Fertig, wenn: die Windows-Funktionen vollständig gestaltet sind, die automatischen Prüfungen bestehen und Fehler-, Verbindungs- und Offline-Szenarien geprüft sind.

## Phase 6: Windows-Veröffentlichung und Abnahme

Die Vorbereitung aus Phase 3 wird hier bis zur nutzbaren Veröffentlichung abgeschlossen:

- [ ] Update-Ablage, öffentlichen Schlüssel und HTTPS-Endpunkt einrichten; signierte Update-Artefakte erzeugen
- [ ] Herunterladen und Einspielen von Updates einschließlich Fehleranzeige und Neustart verdrahten und mit zwei Windows-Versionen prüfen
- [ ] Authenticode-Signierung klären und den Windows-Installer signieren (Zertifikat und private Schlüssel außerhalb des Repos)
- [ ] Installation, Startmenü-Eintrag, Aktualisierung und Deinstallation unter Windows manuell prüfen
- [ ] Windows-Prüfliste aus Phase 3 vollständig abnehmen: Tray, Schließen/Beenden, Medientasten, Leertaste, Fensterzustand und Persistenz
- [ ] Gemeinsame Abnahme von Technik und Design: Bibliothek, Suche, Favoriten, Playlists, Player, Queue, Einstellungen, Server-Profile und Offline-Funktionen
- [ ] Release-Unterlagen mit Versionsstand, Installationshinweisen und bekannten Einschränkungen fertigstellen
- [ ] Keine offenen releaseblockierenden Windows-Fehler; bekannte Plattformgrenzen dokumentieren (z. B. WebView2-Anwendungsname in der Mediensteuerung)
- [ ] Windows-Version veröffentlichen und Abschluss der Windows-Abnahme in beiden Roadmaps festhalten

**Startbedingung für Android:** Phasen 4–6 und die Windows-Abnahme der Design-Roadmap sind abgeschlossen. Offene Veröffentlichungsschritte gelten weiterhin als Windows-Arbeit und geben Android nicht automatisch frei.

## Phase 7: Android (nach Windows-Abnahme)

- [ ] `pnpm tauri android dev` auf Emulator und echtem Gerät lauffähig
- [ ] **Hintergrundwiedergabe**: natives Plugin mit Foreground-Service und `MediaSession`/Media3, Benachrichtigung mit Steuerung, Sperrbildschirm
- [ ] Audio-Fokus (Anruf, andere Apps) und Kopfhörer-Events
- [ ] Zurück-Taste und Systemleisten (Insets) sauber behandeln
- [ ] Mobile Gestaltung aus der Design-Roadmap auf echten Geräten abnehmen
- [ ] Offline-Funktionen und sichere Ablage an Android anpassen und prüfen
- [ ] Release-Build, Signierung (Keystore **nicht** ins Repo)
- [ ] CI um Android-Build ergänzen
- [ ] Gemeinsame Logik prüfen: kein Windows-Sonderweg im geteilten Code; Windows-Regressionstests bestehen weiterhin

Das ist die riskanteste Plattformphase. Mit WebView-Audio allein stoppt die Wiedergabe, sobald die App in den Hintergrund geht.

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
