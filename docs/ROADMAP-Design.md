# Roadmap Design

Wird von Claude (Frontend-Design) umgesetzt, nachdem die Technik-Phasen die Funktionen liefern. Die technische Seite steht in [ROADMAP-Technik.md](ROADMAP-Technik.md).

## Priorität: Windows vollständig abschließen (18.10.2026)

Die offenen Windows-Aufgaben in dieser Roadmap werden parallel zu Technik-Phase 4–6 abgeschlossen. Android-Gestaltung und Geräteabnahme beginnen erst nach der gemeinsamen Windows-Abnahme; bereits umgesetzte mobile Grundlagen bleiben erhalten.

### Windows-Abnahme vor Android

- [ ] Alle offenen Windows-Aufgaben aus Grundlagen, App-Rahmen, Bildschirmen und Bewegung abschließen: WCAG-AA-Kontraste, reduzierte Bewegung, obere Leiste, Titelleisten-Entscheidung, Playlist-Mosaik, Übergänge und Fortschrittsvorschau
- [ ] Offline-Bibliothek, Downloads, Speicherverwaltung und Offline-/Verbindungszustände mit den echten Funktionen aus Technik-Phase 4 fertig gestalten
- [ ] Einstellungen für sichere Ablage, Server-Profile und Diagnose aus Technik-Phase 5 vervollständigen
- [ ] Windows-Einstellungen, Tastenkürzel und Update-Ablauf aus Technik-Phase 6 fertig gestalten, einschließlich Fortschritt, Fehlern und Neustart
- [ ] Alle Windows-Ansichten bei kleiner Fenstergröße, Desktop und Ultrawide auf Layout, Tastaturbedienung, sichtbaren Fokus und Lesbarkeit prüfen
- [ ] Gemeinsame Abnahme mit Technik-Phase 6 dokumentieren; keine offenen releaseblockierenden Windows-Designfehler

Synchrone Songtexte und „Beliebteste Titel“ bleiben von der technischen Verfügbarkeit abhängig und gehören zu den optionalen Erweiterungen. Sie blockieren die Windows-Abnahme nicht.

## Ziel

Spotify-nah in der Bedienung, aber eigenständiger und ausdrucksstärker: dunkel, kräftige Farbverläufe aus dem Logo, viel Cover-Fläche, flüssige Bewegung. Die Oberfläche soll nach eigener Marke aussehen, nicht nach Spotify-Klon.

## Grundlagen

- [x] **Icons:** `lucide-react` für alles (Wiedergabe, Navigation, Herz, Queue, Suche, Einstellungen). Die Unicode-Zeichen im Player (`⏮ ▶ ⏭`) fallen weg.
- [x] **Design-Tokens** in CSS-Variablen: Farben, Abstände, Radien, Schatten, Bewegungsdauern, Schriftgrößen. Aufteilung von `styles.css` in `tokens.css`, `base.css` und je Komponente.
- [x] **Farbwelt:** Violett → Pink → Bernstein aus dem Logo als Markenverlauf. Hintergründe dunkel mit leichtem Violettstich, kein reines Schwarz.
- [x] **Typografie:** eine markante Überschriftenschrift plus gut lesbare Textschrift, lokal eingebunden (keine CDN-Fonts).
- [x] **Dynamische Akzentfarbe:** aus dem Cover des laufenden Titels abgeleitet, färbt Player, Album-Kopf und Hintergrundverlauf.
- [x] **Fokus, Hover, aktiv** für jedes interaktive Element, Tastaturbedienung sichtbar.
- [ ] Kontraste mindestens WCAG AA, `prefers-reduced-motion` respektieren.

## App-Rahmen

- [x] Seitenleiste mit Navigation (Start, Suche, Bibliothek, Playlists) und eingeklappter Variante
- [ ] Obere Leiste mit Suchfeld, Zurück/Vor, Profil
- [x] Player-Leiste unten: Cover, Titel, Herz, Steuerung, Fortschritt, Lautstärke, Queue-Knopf
- [x] Mobile Variante: Bottom-Navigation, Mini-Player, der sich zum Vollbild-Player aufzieht
- [ ] Fenstertitelleiste für Windows prüfen (eigene Titelleiste vs. Standard)

## Bildschirme

- [x] **Login:** Logo groß, Verlauf im Hintergrund, klare Fehlerzustände
- [x] **Start:** Begrüßung, Schnellzugriff-Kacheln, Reihen (Neu, Zuletzt, Zufällig) mit horizontalem Scrollen
- [x] **Album:** großes Cover, Verlauf aus Coverfarbe, Trackliste mit Hover-Play, Format-/Bitrate-Badge
- [x] **Künstler:** Hero-Bild, Diskografie, Ähnliche Künstler (Beliebteste Titel technisch noch nicht verfügbar, siehe Abgleich)
- [~] **Playlist:** Kopf mit Mosaik-Cover, Sortierung, Drag-and-drop (Ziehen fertig, Mosaik-Cover offen)
- [x] **Suche:** Ergebnisse nach Typ gruppiert, Sofortvorschläge
- [x] **Queue:** Ausklappbares Panel mit „Als Nächstes“ und Verlauf
- [~] **Vollbild-Player:** großes Cover, Visualisierung (Klangbänder aus dem Logo-Motiv, folgen dem Spektrum; nur Desktop) fertig, synchrone Songtexte als optionale Erweiterung offen
- [x] **Einstellungen:** Server, Wiedergabe-Qualität, Offline-Speicher, Erscheinungsbild
- [x] Leer-, Lade- und Fehlerzustände für jede Ansicht (Skeletons statt Spinner)

## Bewegung

- [ ] Seitenübergänge, Cover-Übergang von Raster zur Album-Seite
- [x] Mikro-Interaktionen: Herz-Pop, Play-Button-Wechsel, Equalizer-Balken am aktiven Titel
- [ ] Fortschrittsbalken mit Hover-Vorschau
- [ ] Alles abschaltbar über `prefers-reduced-motion`

## Responsives Verhalten

- [x] Breiten: Handy, Tablet, Desktop, Ultrawide

### Android nach Windows-Abnahme (Technik-Phase 7)

- [ ] Touch-Ziele mindestens 44 px, Wischgesten im Mini-Player
- [ ] Insets und Notch auf Android beachten
- [ ] Bottom-Navigation, Mini-Player und Vollbild-Player mit nativer Hintergrundwiedergabe auf Emulator und echtem Gerät prüfen
- [ ] Mobile Offline-, Verbindungs- und Fehlerzustände abnehmen

## Abgleich mit Technik

Design braucht von der Technik, bevor die Bildschirme fertig sein können:

| Bildschirm | Benötigt aus Phase | Stand |
| --- | --- | --- |
| Start, Album, Künstler, Suche, Playlist | Technik 1 | **geliefert** |
| Genres, Genre, Favoriten, Albenliste | Technik 1 | **geliefert** |
| Queue-Panel, Vollbild-Player | Technik 2 | **geliefert** (Entfernen, Umsortieren, Shuffle, Wiederholen sind da) |
| Windows-Hülle: Tray, Medientasten, Update-Prüfung | Technik 3 | **geliefert** (Abschnitt „Windows“ in den Einstellungen) |
| Offline-Bibliothek, Downloads, Speicherverwaltung | Technik 4 | offen, vor Android |
| Server-Profile, sichere Ablage, Diagnose | Technik 5 | offen, vor Android |
| Windows-Update-Ablauf und Veröffentlichung | Technik 6 | offen, vor Android |
| Mobile Mini-Player und Android-Systemleisten | Technik 7 | Grundlage vorhanden; Integration und Geräteabnahme nach Windows |
| Songtexte | Technik „Ideen“ | offen |

### Was aus Technik 1 schon dasteht

Roh gebaut, ohne Gestaltung, aber vollständig bedienbar:

- **Routen:** `#/` (Start), `#/search`, `#/artists`, `#/artist/:id`, `#/albums`, `#/album/:id`, `#/genres`, `#/genre/:name`, `#/favorites`, `#/playlists`, `#/playlist/:id`.
- **Navigation:** `src/components/Layout.tsx` enthält die Navigation (`.nav`) mit Links auf alle Ansichten, inklusive `#/settings`.
- **Bausteine zum Einkleiden:** `QueryStates` (Lade-, Leer- und Fehlerzustand), `AlbumGrid`, `ArtistGrid`, `SongList`, `FavoriteButton`, `Pager`, `AddToPlaylist`, `AlbumSection` (Startseiten-Reihe).
- **Provisorische Layout-Regeln:** die aus Technik 1 sind in den aufgeteilten Stylesheets aufgegangen; die aus Technik 2 liegen in `src/styles/glue.css`.
- **Zustände:** jede Liste liefert Lade-, Leer- und Fehlerzustand. `QueryStates` bekommt die Texte als Props – hier können Skeletons und Illustrationen eingehängt werden.
- **Noch nicht vorhanden:** „Beliebteste Titel“ auf der Künstlerseite (Navidrome liefert ohne Last.fm-Anbindung keine `getTopSongs`-Daten). Queue-Panel und Vollbild-Player sind inzwischen vorhanden; siehe Technik 2 und die Bildschirm-Checkliste.

### Was aus Technik 2 dazukam

- **Player-Leiste:** Zufall und Wiederholen (aus, Warteschlange, Titel) sitzen jetzt links und rechts in `Transport`, also in Leiste und Vollbild-Player gleich. Der Zustand kommt aus `usePlayer((s) => s.shuffle)` und `s.repeat`.
- **Warteschlange:** `QueuePanel` kann je Zeile nach oben/unten schieben und entfernen, oben rechts die ganze Liste leeren. Die Zeilen sind dafür jetzt zweigeteilt: Sprungfläche (`.queue-jump`) plus `.queue-actions`, die erst beim Zeigen eingeblendet werden.
- **Titellisten:** `SongList` hat je Zeile zwei zusätzliche Aktionen („Als Nächstes“, „Anhängen“). Über die Eigenschaft `queueActions={false}` abschaltbar, falls sie stören – oder besser: in ein Menü je Zeile zusammenfassen.
- **Player-Hinweise:** `.player-note` zeigt im Player „Puffert …“ beim Laden und die Fehlermeldung mit Wiederholen-Knopf, wenn ein Titel nicht läuft.
- **Einstellungen:** neue Seite `#/settings` mit Bitrate, Format, ReplayGain, Vorladen, Scrobbling und „Warteschlange merken“. Roh gebaut (Auswahlfelder, Hinweistexte) und ein Kandidat für die Gestaltung.
- **Layout-Regeln:** die provisorischen Regeln aus Technik 1 und 2 sind in den aufgeteilten Stylesheets aufgegangen (`media.css`, `player.css`, `settings.css`, `shell.css`).

### Was aus Technik 3 dazukam

- **Einstellungen „Windows“:** neuer Abschnitt mit zwei Schaltern („Beim Schließen in den Tray“, „Medientasten abfangen“) und der Update-Prüfung, gebaut mit `Setting` und `Switch` in deinem Stil. `Switch` unterstützt seit dem Technik-Review `disabled`; während Änderungen sind die beiden Windows-Schalter gesperrt. Beim ersten Lesen der Werte steht weiterhin kurz „…“. Zu gestalten bleibt hier Feinschliff.
- **Hinweis auf die Leertaste:** Zeile „Tastenkürzel“ im Abschnitt Wiedergabe. Bewusst schlicht (`<span className="muted">Leertaste</span>`) – ein `<kbd>`-Stil wäre der nächste Schritt.
- **Sonst nichts im Fenster:** Tray-Symbol, Medientasten, Fenstergedächtnis und Installer liegen außerhalb der Oberfläche. Dafür gibt es keine neuen Flächen zu gestalten.
- **Fehlerhinweis im Player:** `.player-note` bleibt wie übernommen (Puffern und Fehler mit Wiederholen-Knopf).

Die Windows-Grundlagen des App-Rahmens stehen. Als Nächstes folgen die offenen Windows-Aufgaben und die Gestaltung der Technik-Phasen 4–6 bis zur gemeinsamen Windows-Abnahme. Erst danach folgen Android-Integration, mobile Detailarbeit und Geräteabnahme in Technik-Phase 7.


