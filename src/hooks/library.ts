import { useQuery } from "@tanstack/react-query";
import type { AlbumListType } from "../api/types";
import { keys, type AlbumListFilter } from "./keys";
import { useClient } from "./useClient";

/** Künstler nach Buchstaben gruppiert. */
export function useArtistIndexes() {
  const client = useClient();
  return useQuery({ queryKey: keys.artists, queryFn: () => client.getArtistIndexes() });
}

/** Ein Künstler mit seinen Alben. */
export function useArtist(id: string) {
  const client = useClient();
  return useQuery({ queryKey: keys.artist(id), queryFn: () => client.getArtist(id), enabled: Boolean(id) });
}

/** Biografie und ähnliche Künstler. */
export function useArtistInfo(id: string) {
  const client = useClient();
  return useQuery({ queryKey: keys.artistInfo(id), queryFn: () => client.getArtistInfo2(id), enabled: Boolean(id) });
}

/** Beliebteste Titel; ohne Last.fm-Anbindung des Servers kommt eine leere Liste. */
export function useTopSongs(artist: string) {
  const client = useClient();
  return useQuery({ queryKey: keys.topSongs(artist), queryFn: () => client.getTopSongs(artist, 10), enabled: Boolean(artist), retry: false });
}

/** Songtexte eines Titels; nur anfragen, wenn der Server `songLyrics` meldet. */
export function useLyrics(songId: string | undefined, enabled: boolean) {
  const client = useClient();
  return useQuery({
    queryKey: keys.lyrics(songId ?? ""),
    queryFn: () => client.getLyricsBySongId(songId ?? ""),
    enabled: enabled && Boolean(songId),
    retry: false,
    staleTime: Infinity,
  });
}

/** Albumliste eines Typs; `offset` und `size` steuern die Seiten. */
export function useAlbumList(type: AlbumListType, size = 40, offset = 0, filter: AlbumListFilter = {}) {
  const client = useClient();
  return useQuery({
    queryKey: keys.albumList(type, size, offset, filter),
    queryFn: () => client.getAlbumList(type, size, offset, filter),
  });
}

/** Ein Album mit Titelliste. */
export function useAlbum(id: string) {
  const client = useClient();
  return useQuery({ queryKey: keys.album(id), queryFn: () => client.getAlbum(id), enabled: Boolean(id) });
}

export function useGenres() {
  const client = useClient();
  return useQuery({ queryKey: keys.genres, queryFn: () => client.getGenres() });
}

export function useSongsByGenre(genre: string, count = 100, offset = 0) {
  const client = useClient();
  return useQuery({
    queryKey: keys.songsByGenre(genre, count, offset),
    queryFn: () => client.getSongsByGenre(genre, count, offset),
    enabled: Boolean(genre),
  });
}

/** Favoriten: Künstler, Alben und Titel. */
export function useStarred() {
  const client = useClient();
  return useQuery({ queryKey: keys.starred, queryFn: () => client.getStarred2() });
}

/**
 * Suche über `search3`. Erst ab zwei Zeichen wird der Server gefragt,
 * die Entprellung übernimmt der Aufrufer.
 */
export function useSearch(term: string) {
  const client = useClient();
  const query = term.trim();
  return useQuery({
    queryKey: keys.search(query),
    queryFn: () => client.search3(query),
    enabled: query.length >= 2,
  });
}
