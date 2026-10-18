import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StarIds } from "../api/types";
import { keys, libraryPrefixes } from "./keys";
import { useClient } from "./useClient";

export interface StarInput {
  ids: StarIds;
  /** true = Element ist bereits Favorit und wird entfernt. */
  starred: boolean;
}

/** Favorit setzen oder entfernen, je nach aktuellem Zustand. */
export function useStar() {
  const client = useClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, starred }: StarInput) => (starred ? client.unstar(ids) : client.star(ids)),
    onSuccess: (_result, { ids }) => {
      queryClient.invalidateQueries({ queryKey: keys.starred });
      // Nur die Listen auffrischen, in denen das Element vorkommen kann.
      if (ids.albumId) queryClient.invalidateQueries({ queryKey: libraryPrefixes.albumList });
      if (ids.artistId) {
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.artist });
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.artists });
      }
      if (ids.id) {
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.album });
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.songsByGenre });
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.playlist });
        queryClient.invalidateQueries({ queryKey: libraryPrefixes.search });
      }
    },
  });
}
