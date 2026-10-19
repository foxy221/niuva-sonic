import type { AlbumListType } from "../api/types";

/** Zusatzfilter für `getAlbumList2` (nur `byYear` und `byGenre` brauchen sie). */
export type AlbumListFilter = { fromYear?: number; toYear?: number; genre?: string };

/** `undefined`-Werte fallen weg, damit gleiche Abfragen denselben Schlüssel bekommen. */
function clean(filter: AlbumListFilter) {
  return Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined)) as AlbumListFilter;
}

/** Alle Query-Schlüssel an einer Stelle, damit Mutationen gezielt auffrischen können. */
export const keys = {
  artists: ["artists"] as const,
  artist: (id: string) => ["artist", id] as const,
  artistInfo: (id: string) => ["artistInfo", id] as const,
  topSongs: (artist: string) => ["topSongs", artist] as const,
  lyrics: (songId: string) => ["lyrics", songId] as const,
  album: (id: string) => ["album", id] as const,
  albumList: (type: AlbumListType, size: number, offset: number, filter: AlbumListFilter = {}) =>
    ["albumList", type, size, offset, clean(filter)] as const,
  genres: ["genres"] as const,
  radio: ["radio"] as const,
  songsByGenre: (genre: string, count: number, offset: number) => ["songsByGenre", genre, count, offset] as const,
  starred: ["starred"] as const,
  playlists: ["playlists"] as const,
  playlist: (id: string) => ["playlist", id] as const,
  search: (term: string) => ["search", term] as const,
};

/** Alle Listen, die Favoriten- oder Playlist-Daten enthalten. */
export const libraryPrefixes = {
  albumList: ["albumList"] as const,
  album: ["album"] as const,
  artist: ["artist"] as const,
  artistInfo: ["artistInfo"] as const,
  artists: ["artists"] as const,
  songsByGenre: ["songsByGenre"] as const,
  playlist: ["playlist"] as const,
  playlists: ["playlists"] as const,
  search: ["search"] as const,
};
