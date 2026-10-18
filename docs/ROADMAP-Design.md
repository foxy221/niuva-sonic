# Roadmap Design

Wird von Claude (Frontend-Design) umgesetzt, nachdem die Technik-Phasen die Funktionen liefern. Die technische Seite steht in [ROADMAP-Technik.md](ROADMAP-Technik.md).

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
- [x] **Künstler:** Hero-Bild, Beliebteste Titel, Diskografie, Ähnliche Künstler
- [ ] **Playlist:** Kopf mit Mosaik-Cover, Sortierung, Drag-and-drop
- [x] **Suche:** Ergebnisse nach Typ gruppiert, Sofortvorschläge
- [x] **Queue:** Ausklappbares Panel mit „Als Nächstes“ und Verlauf
- [~] **Vollbild-Player:** großes Cover, Songtexte synchron, Visualisierung (Wellenform aus dem Logo-Motiv)
- [ ] **Einstellungen:** Server, Wiedergabe-Qualität, Offline-Speicher, Erscheinungsbild
- [x] Leer-, Lade- und Fehlerzustände für jede Ansicht (Skeletons statt Spinner)

## Bewegung

- [ ] Seitenübergänge, Cover-Übergang von Raster zur Album-Seite
- [x] Mikro-Interaktionen: Herz-Pop, Play-Button-Wechsel, Equalizer-Balken am aktiven Titel
- [ ] Fortschrittsbalken mit Hover-Vorschau
- [ ] Alles abschaltbar über `prefers-reduced-motion`

## Responsives Verhalten

- [x] Breiten: Handy, Tablet, Desktop, Ultrawide
- [ ] Touch-Ziele mindestens 44 px, Wischgesten im Mini-Player
- [ ] Insets und Notch auf Android beachten

## Abgleich mit Technik

Design braucht von der Technik, bevor die Bildschirme fertig sein können:

| Bildschirm | Benötigt aus Phase | Stand |
| --- | --- | --- |
| Start, Album, Künstler, Suche, Playlist | Technik 1 | **geliefert** |
| Genres, Genre, Favoriten, Albenliste | Technik 1 | **geliefert** |
| Queue-Panel, Vollbild-Player | Technik 2 | **geliefert** (Entfernen, Umsortieren, Shuffle, Wiederholen sind da) |
| Mobile Mini-Player | Technik 4 | offen |
| Songtexte | Technik „Ideen“ | offen |

### Was aus Technik 1 schon dasteht

Roh gebaut, ohne Gestaltung, aber vollständig bedienbar:

- **Routen:** `#/` (Start), `#/search`, `#/artists`, `#/artist/:id`, `#/albums`, `#/album/:id`, `#/genres`, `#/genre/:name`, `#/favorites`, `#/playlists`, `#/playlist/:id`.
- **Navigation:** `src/components/Layout.tsx` enthält die Navigation (`.nav`) mit Links auf alle Ansichten, inklusive `#/settings`.
- **Bausteine zum Einkleiden:** `QueryStates` (Lade-, Leer- und Fehlerzustand), `AlbumGrid`, `ArtistGrid`, `SongList`, `FavoriteButton`, `Pager`, `AddToPlaylist`, `AlbumSection` (Startseiten-Reihe).
- **Provisorische Layout-Regeln:** die aus Technik 1 sind in den aufgeteilten Stylesheets aufgegangen; die aus Technik 2 liegen in `src/styles/glue.css`.
- **Zustände:** jede Liste liefert Lade-, Leer- und Fehlerzustand. `QueryStates` bekommt die Texte als Props – hier können Skeletons und Illustrationen eingehängt werden.
- **Noch nicht vorhanden:** „Beliebteste Titel“ auf der Künstlerseite (Navidrome liefert ohne Last.fm-Anbindung keine `getTopSongs`-Daten) und Queue-Panel/Vollbild-Player (Technik 2).

### Was aus Technik 2 dazukam

- **Player-Leiste:** Zufall und Wiederholen (aus, Warteschlange, Titel) sitzen jetzt links und rechts in `Transport`, also in Leiste und Vollbild-Player gleich. Der Zustand kommt aus `usePlayer((s) => s.shuffle)` und `s.repeat`.
- **Warteschlange:** `QueuePanel` kann je Zeile nach oben/unten schieben und entfernen, oben rechts die ganze Liste leeren. Die Zeilen sind dafür jetzt zweigeteilt: Sprungfläche (`.queue-jump`) plus `.queue-actions`, die erst beim Zeigen eingeblendet werden.
- **Titellisten:** `SongList` hat je Zeile zwei zusätzliche Aktionen („Als Nächstes“, „Anhängen“). Über die Eigenschaft `queueActions={false}` abschaltbar, falls sie stören – oder besser: in ein Menü je Zeile zusammenfassen.
- **Player-Hinweise:** `.player-note` zeigt im Player „Puffert …“ beim Laden und die Fehlermeldung mit Wiederholen-Knopf, wenn ein Titel nicht läuft.
- **Einstellungen:** neue Seite `#/settings` mit Bitrate, Format, ReplayGain, Vorladen, Scrobbling und „Warteschlange merken“. Roh gebaut (Auswahlfelder, Hinweistexte) und ein Kandidat für die Gestaltung.
- **Layout-Regeln:** wie in Technik 1 liegen die provisorischen Regeln in `src/styles/glue.css`, eingebunden am Ende von `styles.css`. Beim Aufteilen einfach ersetzen.

Damit steht der App-Rahmen vollständig; die Phasen 3 (Windows) und 4 (Android) ändern daran wenig.

