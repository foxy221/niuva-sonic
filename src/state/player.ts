import { create } from "zustand";
import type { Song } from "../api/types";
import { useSession } from "./session";

const audio = new Audio();
audio.preload = "auto";

interface PlayerState {
  queue: Song[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  playQueue: (songs: Song[], startIndex?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
}

export const usePlayer = create<PlayerState>((set, get) => {
  function load(index: number) {
    const { queue } = get();
    const song = queue[index];
    const client = useSession.getState().client;
    if (!song || !client) return;
    audio.src = client.streamUrl(song.id);
    audio.play().catch(() => set({ playing: false }));
    set({ index, position: 0, duration: song.duration ?? 0 });
    updateMediaSession(song, client.coverArtUrl(song.coverArt ?? song.id, 512));
  }

  return {
    queue: [],
    index: -1,
    playing: false,
    position: 0,
    duration: 0,
    volume: Number(localStorage.getItem("volume") ?? 0.8),

    playQueue(songs, startIndex = 0) {
      set({ queue: songs });
      load(startIndex);
    },

    toggle() {
      if (get().index < 0) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },

    next() {
      const { index, queue } = get();
      if (index + 1 < queue.length) load(index + 1);
      else audio.pause();
    },

    prev() {
      const { index } = get();
      if (audio.currentTime > 3 || index <= 0) audio.currentTime = 0;
      else load(index - 1);
    },

    seek(seconds) {
      audio.currentTime = seconds;
      set({ position: seconds });
    },

    setVolume(v) {
      audio.volume = v;
      localStorage.setItem("volume", String(v));
      set({ volume: v });
    },
  };
});

function updateMediaSession(song: Song, artwork: string) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: [{ src: artwork, sizes: "512x512" }],
  });
}

function initAudioEvents() {
  const set = usePlayer.setState;
  audio.volume = usePlayer.getState().volume;
  audio.addEventListener("play", () => set({ playing: true }));
  audio.addEventListener("pause", () => set({ playing: false }));
  audio.addEventListener("timeupdate", () => set({ position: audio.currentTime }));
  audio.addEventListener("durationchange", () => Number.isFinite(audio.duration) && set({ duration: audio.duration }));
  audio.addEventListener("ended", () => usePlayer.getState().next());
}

function initMediaSessionActions() {
  if (!("mediaSession" in navigator)) return;
  const p = () => usePlayer.getState();
  navigator.mediaSession.setActionHandler("play", () => p().toggle());
  navigator.mediaSession.setActionHandler("pause", () => p().toggle());
  navigator.mediaSession.setActionHandler("nexttrack", () => p().next());
  navigator.mediaSession.setActionHandler("previoustrack", () => p().prev());
  navigator.mediaSession.setActionHandler("seekto", (d) => d.seekTime != null && p().seek(d.seekTime));
}

initAudioEvents();
initMediaSessionActions();
