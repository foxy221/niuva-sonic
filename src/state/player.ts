import { create } from "zustand";
import type { Song } from "../api/types";
import { AudioEngine, type MediaFailure } from "./audioEngine";
import {
  addListened,
  applyGain,
  clampIndex,
  gainFor,
  moveItem,
  nextIndex,
  prevIndex,
  removeAt,
  repeatOrder,
  shouldScrobble,
  shuffled,
  streamOptions,
  type RepeatMode,
} from "./player.logic";
import { useSession } from "./session";
import { useSettings } from "./settings";
import { readValue, removeValue, writeValue } from "./storage";

const FILE = "player.json";
const KEY = "playerQueue";
/** Wartezeit, bis Warteschlange und Position geschrieben werden. */
const SAVE_DELAY = 4000;
/** So oft darf nach einem Fehler automatisch weitergerutscht werden. */
const MAX_FAILURES = 3;

interface SavedPlayer {
  serverUrl: string;
  queue: Song[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

interface PlayerState {
  /** Warteschlange in Abspielreihenfolge; `queue[index]` läuft gerade. */
  queue: Song[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  /** Wartet auf Daten (Puffer oder Netzwechsel). */
  buffering: boolean;
  /** Klartextmeldung des letzten Wiedergabefehlers. */
  error: string | null;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Reihenfolge vor dem Mischen, damit Ausschalten sie wiederherstellt. */
  unshuffled: Song[] | null;
  playQueue: (songs: Song[], startIndex?: number) => void;
  jumpTo: (index: number) => void;
  appendToQueue: (songs: Song[]) => void;
  playNext: (songs: Song[]) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  dismissError: () => void;
  retry: () => void;
  reset: () => void;
  /** Warteschlange der letzten Sitzung laden (nur bei gleichem Server). */
  restore: () => Promise<void>;
}
let scrobbleState: { songId: string; startedAt: number; submitted: boolean } | null = null;
let listened = 0;
let lastPosition = 0;
let failures = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const client = () => useSession.getState().client;
const playback = () => useSettings.getState().settings;

function streamUrlFor(song: Song) {
  const session = client();
  return session ? session.streamUrl(song.id, streamOptions(playback())) : "";
}

function gainFactor(song?: Song) {
  return song ? gainFor(song, playback().replayGain) : 1;
}

/** Elementlautstärke = Nutzerlautstärke mal ReplayGain. */
function applyVolume(song?: Song) {
  engine.setVolume(applyGain(usePlayer.getState().volume, gainFactor(song)));
}

/** Wiedergabe melden. Ein Fehler dabei darf die Musik nicht stören. */
function reportScrobble(id: string, submission: boolean, time?: number) {
  const session = client();
  if (!session || !playback().scrobble) return;
  session.scrobble({ id, submission, time }).catch(() => {});
}

function updateMediaSession(song: Song, artwork: string) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: [{ src: artwork, sizes: "512x512" }],
  });
}

function setPlaybackState(state: MediaSessionPlaybackState) {
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state;
}

/** Position an die Systemsteuerung melden (Windows-Overlay, Sperrbildschirm). */
function updatePositionState(position: number) {
  if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") return;
  const { duration } = usePlayer.getState();
  if (!duration || position < 0 || position > duration) return;
  try {
    navigator.mediaSession.setPositionState({ duration, position, playbackRate: 1 });
  } catch {
    // Werte knapp hinter dem Ende sind hier unkritisch.
  }
}

function clearMediaSession() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Record<string, unknown>;
  return typeof song.id === "string" && song.id.length > 0 && typeof song.title === "string";
}

async function saveNow() {
  const { queue, index, shuffle, repeat, position } = usePlayer.getState();
  const creds = useSession.getState().creds;
  if (!creds || !playback().rememberQueue || !queue.length || index < 0) return;
  const state: SavedPlayer = { serverUrl: creds.serverUrl, queue, index, position, shuffle, repeat };
  try {
    await writeValue(FILE, KEY, state);
  } catch {
    // Ohne gemerkte Warteschlange startet die App trotzdem.
  }
}

/** Änderungen sammeln: die Position ändert sich im Sekundentakt. */
function scheduleSave() {
  if (!playback().rememberQueue || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, SAVE_DELAY);
}
function handlePlay() {
  usePlayer.setState({ playing: true, buffering: false });
  setPlaybackState("playing");
  scheduleSave();
}

function handlePause() {
  usePlayer.setState({ playing: false });
  setPlaybackState("paused");
  void saveNow();
}

function handleReady() {
  failures = 0;
  usePlayer.setState({ buffering: false });
}

function handleWaiting() {
  usePlayer.setState({ buffering: true });
}

function handleDuration(duration: number) {
  usePlayer.setState({ duration });
}

function handleTime(position: number) {
  listened = addListened(listened, lastPosition, position);
  lastPosition = position;
  usePlayer.setState({ position });
  updatePositionState(position);
  if (scrobbleState && !scrobbleState.submitted && shouldScrobble(listened, usePlayer.getState().duration)) {
    scrobbleState.submitted = true;
    reportScrobble(scrobbleState.songId, true, scrobbleState.startedAt);
  }
  scheduleSave();
}

function handleEnded() {
  advance(true);
}

/**
 * Ein Titel, der nicht lädt, darf die Wiedergabe nicht anhalten: ein paar Mal
 * weiterrutschen, dann stehen bleiben und die Meldung anzeigen.
 */
function handleError(failure: MediaFailure) {
  usePlayer.setState({ buffering: false, error: failure.message });
  const { queue, index } = usePlayer.getState();
  if (failures >= MAX_FAILURES || queue.length <= 1) return;
  failures++;
  setTimeout(() => {
    const state = usePlayer.getState();
    if (!state.error) return;
    const next = state.index + 1 < state.queue.length ? state.index + 1 : 0;
    if (next !== index) load(next);
  }, 600);
}

const engine = new AudioEngine({
  onPlay: handlePlay,
  onPause: handlePause,
  onTime: handleTime,
  onDuration: handleDuration,
  onEnded: handleEnded,
  onError: handleError,
  onWaiting: handleWaiting,
  onReady: handleReady,
});

/**
 * Titel laden. Ist der nächste schon vorgeladen, übernimmt ihn das zweite
 * Element ohne Ladepause.
 */
function load(index: number, options: { autoplay?: boolean; position?: number } = {}) {
  const { autoplay = true, position = 0 } = options;
  const { queue } = usePlayer.getState();
  const song = queue[index];
  const session = client();
  if (!song || !session) return;
  const url = streamUrlFor(song);
  if (!(autoplay && playback().gapless && engine.takePreloaded(url))) engine.load(url, { autoplay, position });

  listened = 0;
  lastPosition = position;
  failures = 0;
  scrobbleState = { songId: song.id, startedAt: Date.now(), submitted: false };
  reportScrobble(song.id, false);

  applyVolume(song);
  usePlayer.setState({ index, position, duration: song.duration ?? 0, playing: autoplay, buffering: autoplay, error: null });
  updateMediaSession(song, session.coverArtUrl(song.coverArt ?? song.id, 512));
  preloadNext();
  scheduleSave();
}

/** Nächsten Titel im Hintergrund laden, damit er ohne Pause startet. */
function preloadNext() {
  const { queue, index, repeat } = usePlayer.getState();
  const session = client();
  if (!session || !playback().gapless || index < 0) {
    engine.preload(null);
    return;
  }
  const next = nextIndex(index, queue.length, repeat, true);
  engine.preload(next === null || next === index ? null : streamUrlFor(queue[next]));
}

/** `automatic` heißt: der Titel ist zu Ende gelaufen. */
function advance(automatic: boolean) {
  const { index, queue, repeat } = usePlayer.getState();
  if (index < 0 || !queue.length) return;
  const next = nextIndex(index, queue.length, repeat, automatic);
  if (next === null) {
    engine.pause();
    engine.seek(0);
    usePlayer.setState({ playing: false, position: 0, buffering: false });
    void saveNow();
    return;
  }
  if (next === index) {
    engine.seek(0);
    engine.play();
    return;
  }
  load(next);
}

/** Denselben Titel neu laden, z. B. nach Netzwechsel oder Qualitätswechsel. */
function reload(index: number, position: number, autoplay: boolean) {
  if (index < 0) return;
  load(index, { autoplay, position });
}
export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  playing: false,
  position: 0,
  duration: 0,
  volume: Number(localStorage.getItem("volume") ?? 0.8),
  buffering: false,
  error: null,
  shuffle: false,
  repeat: "off",
  unshuffled: null,

  playQueue(songs, startIndex = 0) {
    if (!songs.length) return;
    const start = clampIndex(startIndex, songs.length);
    if (get().shuffle) {
      const current = songs[start];
      set({ queue: [current, ...shuffled(songs.filter((_, i) => i !== start))], unshuffled: songs, index: 0 });
      load(0);
      return;
    }
    set({ queue: songs, unshuffled: null, index: start });
    load(start);
  },

  jumpTo(index) {
    if (index < 0 || index >= get().queue.length) return;
    load(index);
  },

  appendToQueue(songs) {
    if (!songs.length) return;
    const { queue, unshuffled, index } = get();
    if (index < 0) {
      get().playQueue(songs, 0);
      return;
    }
    set({ queue: [...queue, ...songs], unshuffled: unshuffled ? [...unshuffled, ...songs] : null });
    preloadNext();
    scheduleSave();
  },

  playNext(songs) {
    if (!songs.length) return;
    const { queue, unshuffled, index } = get();
    if (index < 0) {
      get().playQueue(songs, 0);
      return;
    }
    const current = queue[index];
    let nextUnshuffled: Song[] | null = null;
    if (unshuffled) {
      const at = unshuffled.indexOf(current);
      const position = at < 0 ? unshuffled.length : at + 1;
      nextUnshuffled = [...unshuffled.slice(0, position), ...songs, ...unshuffled.slice(position)];
    }
    set({ queue: [...queue.slice(0, index + 1), ...songs, ...queue.slice(index + 1)], unshuffled: nextUnshuffled });
    preloadNext();
    scheduleSave();
  },

  removeFromQueue(target) {
    const { queue, index, unshuffled } = get();
    if (target < 0 || target >= queue.length) return;
    const song = queue[target];
    const nextQueue = removeAt(queue, target);
    if (!nextQueue.length) {
      get().clearQueue();
      return;
    }
    const wasCurrent = target === index;
    const nextIndex = wasCurrent ? Math.min(index, nextQueue.length - 1) : target < index ? index - 1 : index;
    set({ queue: nextQueue, index: nextIndex, unshuffled: unshuffled ? unshuffled.filter((s) => s !== song) : null });
    if (wasCurrent) load(nextIndex);
    else {
      preloadNext();
      scheduleSave();
    }
  },

  moveInQueue(from, to) {
    const { queue, index } = get();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    let nextIndex = index;
    if (from === index) nextIndex = to;
    else if (from < index && to >= index) nextIndex = index - 1;
    else if (from > index && to <= index) nextIndex = index + 1;
    set({ queue: moveItem(queue, from, to), index: nextIndex });
    preloadNext();
    scheduleSave();
  },

  clearQueue() {
    engine.stop();
    scrobbleState = null;
    clearMediaSession();
    set({ queue: [], index: -1, playing: false, position: 0, duration: 0, buffering: false, error: null, unshuffled: null });
    void removeValue(FILE, KEY).catch(() => {});
  },

  toggle() {
    if (get().index < 0) return;
    if (engine.paused) engine.play();
    else engine.pause();
  },

  next() {
    advance(false);
  },

  prev() {
    const { index, queue, repeat } = get();
    if (index < 0 || !queue.length) return;
    if (engine.position > 3) {
      engine.seek(0);
      set({ position: 0 });
      return;
    }
    const previous = prevIndex(index, queue.length, repeat);
    if (previous === index) {
      engine.seek(0);
      set({ position: 0 });
      return;
    }
    load(previous);
  },

  seek(seconds) {
    engine.seek(seconds);
    // Ein Sprung ist keine Hörzeit: die Scrobble-Regel darf dadurch nicht greifen.
    lastPosition = seconds;
    set({ position: seconds });
  },

  setVolume(value) {
    const volume = Math.max(0, Math.min(1, value));
    localStorage.setItem("volume", String(volume));
    set({ volume });
    applyVolume(get().queue[get().index]);
  },
  toggleShuffle() {
    const { shuffle, queue, index, unshuffled } = get();
    if (!shuffle) {
      const current = queue[index];
      const rest = queue.filter((_, i) => i !== index);
      set({ shuffle: true, unshuffled: queue, queue: current ? [current, ...shuffled(rest)] : shuffled(rest), index: current ? 0 : index });
    } else {
      // Die gemerkte Reihenfolge enthält dieselben Song-Objekte, deshalb
      // findet `indexOf` den laufenden Titel zuverlässig wieder.
      const order = unshuffled ?? queue;
      const current = queue[index];
      const at = current ? order.indexOf(current) : -1;
      set({ shuffle: false, unshuffled: null, queue: order, index: at < 0 ? clampIndex(index, order.length) : at });
    }
    preloadNext();
    scheduleSave();
  },

  cycleRepeat() {
    set({ repeat: repeatOrder[(repeatOrder.indexOf(get().repeat) + 1) % repeatOrder.length] });
    preloadNext();
    scheduleSave();
  },

  dismissError() {
    set({ error: null });
  },

  retry() {
    const { index, position, playing } = get();
    if (index >= 0) reload(index, position, playing);
  },

  reset() {
    engine.stop();
    scrobbleState = null;
    clearMediaSession();
    set({ queue: [], index: -1, playing: false, position: 0, duration: 0, buffering: false, error: null, unshuffled: null });
    void removeValue(FILE, KEY).catch(() => {});
  },

  async restore() {
    await useSettings.getState().restore();
    const creds = useSession.getState().creds;
    if (!creds || !playback().rememberQueue) return;
    const saved = await readValue<SavedPlayer>(FILE, KEY).catch(() => null);
    // Nur die Warteschlange desselben Servers übernehmen: Titel-IDs sind dort gültig.
    if (!saved || saved.serverUrl !== creds.serverUrl || !Array.isArray(saved.queue)) return;
    const queue = saved.queue.filter(isSong);
    if (!queue.length) return;
    const index = clampIndex(saved.index, queue.length);
    set({ queue, index, shuffle: Boolean(saved.shuffle), unshuffled: null, repeat: saved.repeat ?? "off" });
    load(index, { autoplay: false, position: Math.max(0, saved.position || 0) });
  },
}));

// --- Verknüpfungen ------------------------------------------------------

useSession.subscribe((session, previous) => {
  if (session.client === previous.client) return;
  usePlayer.getState().reset();
  void usePlayer.getState().restore();
});

useSettings.subscribe((state, previous) => {
  const now = state.settings;
  const before = previous.settings;
  if (now.maxBitRate !== before.maxBitRate || now.format !== before.format) {
    // Neue Qualität gilt sofort: den laufenden Titel an derselben Stelle neu laden.
    const { index, position, playing } = usePlayer.getState();
    if (index >= 0) reload(index, position, playing);
    return;
  }
  if (now.replayGain !== before.replayGain) {
    const { queue, index } = usePlayer.getState();
    applyVolume(queue[index]);
  }
});

if ("mediaSession" in navigator) {
  const player = () => usePlayer.getState();
  navigator.mediaSession.setActionHandler("play", () => player().toggle());
  navigator.mediaSession.setActionHandler("pause", () => player().toggle());
  navigator.mediaSession.setActionHandler("nexttrack", () => player().next());
  navigator.mediaSession.setActionHandler("previoustrack", () => player().prev());
  navigator.mediaSession.setActionHandler("seekto", (details) => details.seekTime != null && player().seek(details.seekTime));
  navigator.mediaSession.setActionHandler("stop", () => player().clearQueue());
}

// Netzwechsel: anhalten, wenn nichts mehr geht, und wieder anlaufen, sobald es geht.
window.addEventListener("offline", () => {
  if (usePlayer.getState().index >= 0) usePlayer.setState({ buffering: true });
});

window.addEventListener("online", () => {
  const { index, position, playing, buffering, error } = usePlayer.getState();
  if (index >= 0 && (buffering || error)) reload(index, position, playing);
});

// Beim Verstecken sofort schreiben: der Zeitgeber könnte sonst ausfallen.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void saveNow();
});

applyVolume(usePlayer.getState().queue[usePlayer.getState().index]);



