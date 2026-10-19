export interface Credentials {
  serverUrl: string;
  username: string;
  token: string;
  salt: string;
}

/** `ping` – Kennung des Servers; `openSubsonic` sagt, ob Erweiterungen abfragbar sind. */
export interface ServerInfo {
  /** Fassung der Subsonic-API, die der Server beantwortet. */
  version?: string;
  /** Serversoftware, z. B. `navidrome`. */
  type?: string;
  serverVersion?: string;
  openSubsonic?: boolean;
}

/** Ein Eintrag aus `getOpenSubsonicExtensions` (OpenSubsonic-Erweiterung). */
export interface OpenSubsonicExtension {
  name: string;
  /** Fassungen der Erweiterung, die der Server beherrscht. */
  versions?: number[];
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
  artistImageUrl?: string;
  /** ISO-Zeitstempel, nur gesetzt wenn favorisiert. */
  starred?: string;
}

/** Ein Buchstabenblock aus `getArtists` (A, B, …, #, X-Z). */
export interface ArtistIndex {
  name: string;
  artist: Artist[];
}

/**
 * `replayGain` aus den Tags (OpenSubsonic-Erweiterung). Werte in dB, Peaks positiv.
 * Fehlende Werte lässt der Server weg, das Objekt selbst ist immer vorhanden.
 */
export interface ReplayGain {
  trackGain?: number;
  albumGain?: number;
  trackPeak?: number;
  albumPeak?: number;
  /** Ausgangsverstärkung des Formats, z. B. bei Opus. */
  baseGain?: number;
  /** Ersatzwert, wenn der passende Gain fehlt. */
  fallbackGain?: number;
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  year?: number;
  songCount?: number;
  duration?: number;
  coverArt?: string;
  genre?: string;
  created?: string;
  playCount?: number;
  starred?: string;
  replayGain?: ReplayGain;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  albumId?: string;
  artist?: string;
  artistId?: string;
  track?: number;
  discNumber?: number;
  year?: number;
  genre?: string;
  duration?: number;
  coverArt?: string;
  suffix?: string;
  bitRate?: number;
  contentType?: string;
  size?: number;
  created?: string;
  starred?: string;
  /** Anzahl der Wiedergaben laut Server (steigt durch `scrobble`). */
  playCount?: number;
  /** ISO-Zeitstempel der letzten Wiedergabe. */
  played?: string;
  replayGain?: ReplayGain;
  /** Nur bei Radiosendern: Adresse des Live-Streams. Solche Einträge liegen nicht auf dem Server. */
  radioUrl?: string;
}

/** Obergrenze und Zielformat für `stream`; leer heißt Originaldatei. */
export interface StreamOptions {
  /** Bitrate in kbit/s, 0 oder weggelassen = Original. */
  maxBitRate?: number;
  /** `mp3`, `opus`, `aac`, … – leer oder weggelassen = Originalformat. */
  format?: string;
}

export interface AlbumWithSongs extends Album {
  song?: Song[];
}

export interface ArtistWithAlbums extends Artist {
  album?: Album[];
}

/** `getArtistInfo2` – Biografie und ähnliche Künstler. */
export interface ArtistInfo {
  biography?: string;
  smallImageUrl?: string;
  mediumImageUrl?: string;
  largeImageUrl?: string;
  similarArtist?: Artist[];
}

/** Ein Sender aus `getInternetRadioStations`. */
export interface InternetRadioStation {
  id: string;
  name: string;
  streamUrl: string;
  homePageUrl?: string;
}

export interface Genre {
  value: string;
  songCount?: number;
  albumCount?: number;
}

/** `getStarred2` – Favoriten getrennt nach Typ. */
export interface Starred {
  artist?: Artist[];
  album?: Album[];
  song?: Song[];
}

/** Auswahl für `star`/`unstar`; nicht benötigte Listen bleiben weg. */
export type StarIds = {
  id?: string[];
  albumId?: string[];
  artistId?: string[];
};

export interface Playlist {
  id: string;
  name: string;
  comment?: string;
  owner?: string;
  /** Navidrome liefert `null`, wenn nichts gesetzt ist. */
  public?: boolean | null;
  songCount?: number;
  duration?: number;
  created?: string;
  changed?: string;
  coverArt?: string;
  /** true bei serverseitig erzeugten Playlists: nicht änderbar. */
  readonly?: boolean;
}

export interface PlaylistWithSongs extends Playlist {
  entry?: Song[];
}

/** `search3` – Treffer getrennt nach Typ. */
export interface SearchResult3 {
  artist?: Artist[];
  album?: Album[];
  song?: Song[];
}

export type AlbumListType =
  | "newest"
  | "recent"
  | "frequent"
  | "random"
  | "alphabeticalByName"
  | "alphabeticalByArtist"
  | "starred"
  | "byYear"
  | "byGenre";

/** Eine Zeile eines Songtexts; `start` in Millisekunden, nur bei synchronen Texten. */
export interface LyricLine {
  start?: number;
  value: string;
}

/** Songtext im OpenSubsonic-Zuschnitt (`getLyricsBySongId`). */
export interface StructuredLyrics {
  lang?: string;
  synced: boolean;
  /** Verschiebung der Zeitstempel in Millisekunden; positiv = Zeilen kommen später. */
  offset?: number;
  line: LyricLine[];
}
