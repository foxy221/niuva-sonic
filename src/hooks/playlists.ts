import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubsonicClient } from "../api/subsonic";
import type { PlaylistWithSongs, Song } from "../api/types";
import { keys, libraryPrefixes } from "./keys";
import { useClient } from "./useClient";

type UpdateInput = Parameters<SubsonicClient["updatePlaylist"]>[0];

export function usePlaylists() {
  const client = useClient();
  return useQuery({ queryKey: keys.playlists, queryFn: () => client.getPlaylists() });
}

export function usePlaylist(id: string) {
  const client = useClient();
  return useQuery({
    queryKey: keys.playlist(id),
    queryFn: () => client.getPlaylist(id),
    enabled: Boolean(id),
  });
}

/** Neue Playlist anlegen; der Server liefert sie mit neuer ID zurück. */
export function useCreatePlaylist() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => client.createPlaylist({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.playlists }),
  });
}

/** Umbenennen, Titel anhängen, Titel entfernen. */
export function useUpdatePlaylist(playlistId: string) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateInput, "playlistId">) => client.updatePlaylist({ playlistId, ...input }),
    // Auch bei einem Netzwerkfehler könnte der Server die Änderung schon
    // ausgeführt haben. Vor weiteren Index-Aktionen die Liste neu abgleichen.
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.playlist(playlistId) }),
      queryClient.invalidateQueries({ queryKey: libraryPrefixes.playlists }),
    ]),
  });
}

export function useDeletePlaylist() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => client.deletePlaylist(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryPrefixes.playlists }),
  });
}

/**
 * Reihenfolge ändern. Die API kennt kein „Verschieben“: `createPlaylist` mit
 * vorhandener ID ersetzt die Titel und lässt Kommentar und Sichtbarkeit stehen
 * (am Testserver geprüft). Die Liste springt sofort um und fällt bei einem
 * Fehler auf den alten Stand zurück.
 */
export function useReorderPlaylist(playlistId: string) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; songs: Song[] }) =>
      client.createPlaylist({ name: input.name, playlistId, songIds: input.songs.map((song) => song.id) }),
    onMutate: async ({ songs }) => {
      await queryClient.cancelQueries({ queryKey: keys.playlist(playlistId) });
      const previous = queryClient.getQueryData<PlaylistWithSongs>(keys.playlist(playlistId));
      if (previous) queryClient.setQueryData<PlaylistWithSongs>(keys.playlist(playlistId), { ...previous, entry: songs });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(keys.playlist(playlistId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.playlist(playlistId) }),
  });
}
