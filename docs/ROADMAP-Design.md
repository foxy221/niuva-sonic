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
- [ ] **Queue:** Ausklappbares Panel mit „Als Nächstes“ und Verlauf
- [ ] **Vollbild-Player:** großes Cover, Songtexte synchron, Visualisierung (Wellenform aus dem Logo-Motiv)
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
| Queue-Panel, Vollbild-Player | Technik 2 | offen |
| Mobile Mini-Player | Technik 4 | offen |
| Songtexte | Technik „Ideen“ | offen |

### Was aus Technik 1 schon dasteht

Roh gebaut, ohne Gestaltung, aber vollständig bedienbar:

- **Routen:** `#/` (Start), `#/search`, `#/artists`, `#/artist/:id`, `#/albums`, `#/album/:id`, `#/genres`, `#/genre/:name`, `#/favorites`, `#/playlists`, `#/playlist/:id`.
- **Navigation:** `src/components/Layout.tsx` hat jetzt eine `<nav className="topbar-nav">` mit Links auf alle Ansichten. Frei umbaubar (Seitenleiste, Suchfeld in der oberen Leiste).
- **Bausteine zum Einkleiden:** `QueryStates` (Lade-, Leer- und Fehlerzustand), `AlbumGrid`, `ArtistGrid`, `SongList`, `FavoriteButton` (heute Textzeichen `♥ ♡` statt Icons), `Pager`, `AddToPlaylist`, `AlbumSection` (Startseiten-Reihe).
- **Provisorische Layout-Regeln** am Ende von `src/styles.css` (`.topbar-nav`, `.filters`, `.pager`, `.letter-nav`, `.track-row`, `.song-actions`, `.add-to-playlist`, `.playlist-edit`, `.playlist-danger`): nur so viel Layout, dass alles bedienbar ist. Beim Aufteilen von `styles.css` einfach ersetzen.
- **Zustände:** jede Liste liefert Lade-, Leer- und Fehlerzustand. `QueryStates` bekommt die Texte als Props – hier können Skeletons und Illustrationen eingehängt werden.
- **Noch nicht vorhanden:** „Beliebteste Titel“ auf der Künstlerseite (Navidrome liefert ohne Last.fm-Anbindung keine `getTopSongs`-Daten) und Queue-Panel/Vollbild-Player (Technik 2).

Bis Phase 2 entsteht zuerst das Fundament (Tokens, Icons, App-Rahmen), das nichts Neues voraussetzt.
