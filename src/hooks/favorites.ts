import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { StarIds } from "../api/types";
import { keys, libraryPrefixes } from "./keys";
import { usePlayer } from "../state/player";
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
    onSuccess: async (_result, { ids, starred }) => {
      // Die Warteschlange hält eigene Kopien der Titel; ohne das zeigt das Herz im Player den alten Stand.
      if (ids.id) usePlayer.getState().markStarred(ids.id, !starred);
      const affected: (readonly string[])[] = [keys.starred, libraryPrefixes.search];
      // Nur die Listen auffrischen, in denen das Element vorkommen kann.
      if (ids.albumId) affected.push(libraryPrefixes.album, libraryPrefixes.albumList, libraryPrefixes.artist);
      if (ids.artistId) {
        affected.push(libraryPrefixes.artist, libraryPrefixes.artists, libraryPrefixes.artistInfo);
      }
      if (ids.id) {
        affected.push(libraryPrefixes.album, libraryPrefixes.songsByGenre, libraryPrefixes.playlist);
      }
      // Der Button bleibt bis zu den aktualisierten starred-Werten gesperrt.
      await Promise.all(affected.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
