import { create } from "zustand";
import type { Song } from "../api/types";
import { usePlayer } from "./player";

/** Merkt, aus welcher Playlist die Warteschlange gestartet wurde, damit die Seitenleiste sie markieren kann. */
interface PlaylistSource {
  id: string | null;
  songIds: string[];
  mark: (id: string, songs: Song[]) => void;
}

export const usePlaylistSource = create<PlaylistSource>((set) => ({
  id: null,
  songIds: [],
  mark: (id, songs) => set({ id, songIds: songs.map((s) => s.id) }),
}));

/** Die Markierung gilt nur, solange die Warteschlange noch aus dieser Playlist besteht (Shuffle ändert nur die Reihenfolge). */
export function queueMatchesSource(queueIds: string[], source: string[]): boolean {
  return source.length > 0 && queueIds.length === source.length && [...queueIds].sort().join("\n") === [...source].sort().join("\n");
}

/** Id der Playlist, aus der gerade die Warteschlange läuft (oder pausiert), sonst null. */
export function useNowPlayingPlaylist(): { id: string | null; playing: boolean } {
  const sourceId = usePlaylistSource((s) => s.id);
  const sourceSongs = usePlaylistSource((s) => s.songIds);
  const queueKey = usePlayer((s) => s.queue.map((q) => q.id).join(","));
  const playing = usePlayer((s) => s.playing);
  const matches = sourceId !== null && queueMatchesSource(queueKey ? queueKey.split(",") : [], sourceSongs);
  return { id: matches ? sourceId : null, playing };
}
