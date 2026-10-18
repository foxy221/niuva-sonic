import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SubsonicClient } from "../api/subsonic";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.playlist(playlistId) });
      queryClient.invalidateQueries({ queryKey: libraryPrefixes.playlists });
    },
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
