import { create } from "zustand";
import type { Song } from "../api/types";
import { AudioEngine, analysisSupported, type MediaFailure } from "./audioEngine";
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
import { useOffline } from "./offline";
import { logError } from "./log";
import { flushWrites, readValue, removeValue, writeValue } from "./storage";

const FILE = "player.json";
const KEY = "playerQueue";
/** Wartezeit, bis Warteschlange und Position geschrieben werden. */
const SAVE_DELAY = 4000;
/** So oft darf nach einem Fehler automatisch weitergerutscht werden. */
const MAX_FAILURES = 3;

interface SavedPlayer {
  serverUrl: string;
  username: string;
  queue: Song[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Indizes in queue statt Song-Kopien: erhält Identität und doppelte Einträge. */
  unshuffled?: number[];
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
  /** Favoritenstatus gesetzter Titel in der Warteschlange nachziehen, damit Player und Vollbild das Herz richtig zeigen. */
  markStarred: (songIds: string[], starred: boolean) => void;
  clearQueue: () => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  dismissError: () => void;
  retry: () => void;
  reset: (forgetSaved?: boolean) => void;
  /** Warteschlange der letzten Sitzung laden (nur bei gleichem Server). */
  restore: () => Promise<void>;
  flush: () => Promise<void>;
}
let scrobbleState: { songId: string; startedAt: number; submitted: boolean } | null = null;
let listened = 0;
let lastPosition = 0;
let failures = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let failureTimer: ReturnType<typeof setTimeout> | null = null;
let queueRevision = 0;
let wantsPlayback = false;

function cancelFailure() {
  if (failureTimer) clearTimeout(failureTimer);
  failureTimer = null;
}

function cancelSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
}

const client = () => useSession.getState().client;
const playback = () => useSettings.getState().settings;

function streamUrlFor(song: Song) {
  // Radiosender haben eine feste Adresse und liegen weder lokal noch beim Server.
  if (song.radioUrl) return song.radioUrl;
  // Lieber die lokale Datei: schneller Start, kein Datenverkehr, läuft offline.
  const local = useOffline.getState().sourceFor(song.id);
  if (local) return local;
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
  if (!session || !playback().scrobble || id.startsWith("radio:")) return;
  session.scrobble({ id, submission, time }).catch(() => {});
}

function updateMediaSession(song: Song, artwork?: string) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    artwork: artwork ? [{ src: artwork, sizes: "512x512" }] : [],
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
  const { queue, index, shuffle, repeat, position, unshuffled } = usePlayer.getState();
  const creds = useSession.getState().creds;
  if (!creds || !playback().rememberQueue || !queue.length || index < 0) return;
  const used = new Set<number>();
  const order = unshuffled?.map((song) => {
    const at = queue.findIndex((candidate, i) => candidate === song && !used.has(i));
    used.add(at);
    return at;
  });
  const state: SavedPlayer = { serverUrl: creds.serverUrl, username: creds.username, queue, index, position, shuffle, repeat, unshuffled: order };
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
  if (scrobbleState && !scrobbleState.startedAt) {
    scrobbleState.startedAt = Date.now();
    reportScrobble(scrobbleState.songId, false);
  }
  usePlayer.setState({ playing: true, buffering: false });
  setPlaybackState("playing");
  scheduleSave();
}

function handlePause() {
  usePlayer.setState({ playing: false, buffering: false });
  setPlaybackState("paused");
  void saveNow();
}

function handleReady() {
  usePlayer.setState({ buffering: false });
}

function handleWaiting() {
  if (wantsPlayback) usePlayer.setState({ buffering: true });
}

function handleDuration(duration: number) {
  usePlayer.setState({ duration });
}

function handleTime(position: number) {
  if (usePlayer.getState().playing) {
    const nextListened = addListened(listened, lastPosition, position);
    if (nextListened > listened) failures = 0;
    listened = nextListened;
  }
  lastPosition = position;
  usePlayer.setState({ position });
  updatePositionState(position);
  if (scrobbleState?.startedAt && !scrobbleState.submitted && shouldScrobble(listened, usePlayer.getState().duration)) {
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
  cancelFailure();
  logError(failure.message, "Playback failed");
  usePlayer.setState({ playing: false, buffering: false, error: failure.message });
  setPlaybackState("paused");
  const { queue, index } = usePlayer.getState();
  if (!wantsPlayback || failure.code < 2 || failures >= MAX_FAILURES || queue.length <= 1) return;
  failures++;
  failureTimer = setTimeout(() => {
    failureTimer = null;
    const state = usePlayer.getState();
    if (!state.error || !wantsPlayback) return;
    const next = state.index + 1 < state.queue.length ? state.index + 1 : 0;
    if (next !== index) load(next, { preserveFailures: true });
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
}, { analysis: analysisSupported() });

/** Die Audio-Elemente für den Visualizer; `null`, wenn die Analyse nicht läuft. */
export function analysisSource(): readonly HTMLAudioElement[] | null {
  return engine.analysisActive ? engine.audioElements : null;
}

/**
 * Titel laden. Ist der nächste schon vorgeladen, übernimmt ihn das zweite
 * Element ohne Ladepause.
 */
function load(index: number, options: { autoplay?: boolean; position?: number; preserveScrobble?: boolean; preserveFailures?: boolean } = {}) {
  const { autoplay = true, position = 0 } = options;
  const { queue } = usePlayer.getState();
  const song = queue[index];
  const session = client();
  if (!song || !session) return;
  queueRevision++;
  cancelFailure();
  wantsPlayback = autoplay;
  const url = streamUrlFor(song);
  if (!options.preserveScrobble) {
    listened = 0;
    scrobbleState = { songId: song.id, startedAt: 0, submitted: false };
  }
  lastPosition = position;
  if (!options.preserveFailures) failures = 0;

  applyVolume(song);
  usePlayer.setState({ index, position, duration: song.duration ?? 0, playing: false, buffering: autoplay, error: null });
  if (!(autoplay && position === 0 && playback().gapless && engine.takePreloaded(url))) engine.load(url, { autoplay, position });
  if (!autoplay) setPlaybackState("paused");
  // Cover zuerst lokal: offline startet die App sonst ohne Bild im Overlay.
  const artwork = song.radioUrl && !song.coverArt ? undefined : useOffline.getState().coverSource(song.coverArt ?? song.id) ?? session.coverArtUrl(song.coverArt ?? song.id, 512);
  updateMediaSession(song, artwork);
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
  // Ein Live-Stream vorzuladen hieße, ihn schon vor dem Hören zu puffern.
  engine.preload(next === null || next === index || queue[next].radioUrl ? null : streamUrlFor(queue[next]));
}

/** `automatic` heißt: der Titel ist zu Ende gelaufen. */
function advance(automatic: boolean) {
  const { index, queue, repeat } = usePlayer.getState();
  if (index < 0 || !queue.length) return;
  const next = nextIndex(index, queue.length, repeat, automatic);
  if (next === null) {
    wantsPlayback = false;
    engine.pause();
    engine.seek(0);
    lastPosition = 0;
    listened = 0;
    scrobbleState = { songId: queue[index].id, startedAt: 0, submitted: false };
    usePlayer.setState({ playing: false, position: 0, buffering: false });
    void saveNow();
    return;
  }
  if (next === index) {
    load(index);
    return;
  }
  load(next);
}

/** Denselben Titel neu laden, z. B. nach Netzwechsel oder Qualitätswechsel. */
function reload(index: number, position: number, autoplay: boolean) {
  if (index < 0) return;
  load(index, { autoplay, position, preserveScrobble: true });
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
    queueRevision++;
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
    queueRevision++;
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
    queueRevision++;
    const song = queue[target];
    const nextQueue = removeAt(queue, target);
    if (!nextQueue.length) {
      get().clearQueue();
      return;
    }
    const wasCurrent = target === index;
    const nextIndex = wasCurrent ? Math.min(index, nextQueue.length - 1) : target < index ? index - 1 : index;
    set({ queue: nextQueue, index: nextIndex, unshuffled: unshuffled ? removeAt(unshuffled, unshuffled.indexOf(song)) : null });
    if (wasCurrent) load(nextIndex, { autoplay: wantsPlayback });
    else {
      preloadNext();
      scheduleSave();
    }
  },

  moveInQueue(from, to) {
    const { queue, index } = get();
    if (from === to || from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
    queueRevision++;
    let nextIndex = index;
    if (from === index) nextIndex = to;
    else if (from < index && to >= index) nextIndex = index - 1;
    else if (from > index && to <= index) nextIndex = index + 1;
    set({ queue: moveItem(queue, from, to), index: nextIndex });
    preloadNext();
    scheduleSave();
  },

  markStarred(songIds, starred) {
    const mark = (song: Song) => (songIds.includes(song.id) ? { ...song, starred: starred ? new Date().toISOString() : undefined } : song);
    const { queue, unshuffled } = get();
    if (!queue.some((song) => songIds.includes(song.id))) return;
    set({ queue: queue.map(mark), unshuffled: unshuffled ? unshuffled.map(mark) : null });
    scheduleSave();
  },

  clearQueue() {
    get().reset();
  },

  toggle() {
    if (get().index < 0) return;
    if (wantsPlayback && (get().playing || get().buffering)) get().pause();
    else get().play();
  },

  play() {
    if (get().index < 0) return;
    wantsPlayback = true;
    if (get().error) get().retry();
    else if (engine.paused) engine.play();
  },

  pause() {
    wantsPlayback = false;
    cancelFailure();
    engine.pause();
    set({ playing: false, buffering: false });
    setPlaybackState("paused");
  },

  next() {
    advance(false);
  },

  prev() {
    const { index, queue, repeat } = get();
    if (index < 0 || !queue.length) return;
    if (engine.position > 3 && !queue[index].radioUrl) {
      get().seek(0);
      return;
    }
    const previous = prevIndex(index, queue.length, repeat);
    if (previous === index) {
      get().seek(0);
      return;
    }
    load(previous);
  },

  seek(seconds) {
    if (!Number.isFinite(seconds) || get().index < 0 || get().queue[get().index].radioUrl) return;
    const position = Math.max(0, Math.min(seconds, get().duration || seconds));
    engine.seek(position);
    // Ein Sprung ist keine Hörzeit: die Scrobble-Regel darf dadurch nicht greifen.
    lastPosition = position;
    set({ position });
    scheduleSave();
  },

  setVolume(value) {
    const volume = Math.max(0, Math.min(1, value));
    localStorage.setItem("volume", String(volume));
    set({ volume });
    applyVolume(get().queue[get().index]);
  },
  toggleShuffle() {
    queueRevision++;
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
    queueRevision++;
    set({ repeat: repeatOrder[(repeatOrder.indexOf(get().repeat) + 1) % repeatOrder.length] });
    preloadNext();
    scheduleSave();
  },

  dismissError() {
    set({ error: null });
  },

  retry() {
    const { index, position } = get();
    if (index >= 0) reload(index, position, wantsPlayback);
  },

  reset(forgetSaved = true) {
    queueRevision++;
    cancelFailure();
    cancelSave();
    wantsPlayback = false;
    engine.stop();
    scrobbleState = null;
    clearMediaSession();
    set({ queue: [], index: -1, playing: false, position: 0, duration: 0, buffering: false, error: null, unshuffled: null });
    if (forgetSaved) void removeValue(FILE, KEY).catch(() => {});
  },

  async restore() {
    const session = client();
    const revision = queueRevision;
    await useSettings.getState().restore();
    // Vor der Warteschlange: ohne Wurzelverzeichnis gäbe es lokale Titel nur als
    // Server-Adresse, und ein Offline-Start begänne mit einem Ladefehler.
    await useOffline.getState().restore();
    const creds = useSession.getState().creds;
    if (!creds || session !== client() || revision !== queueRevision || !playback().rememberQueue) return;
    const saved = await readValue<SavedPlayer>(FILE, KEY).catch(() => null);
    // Nur die Warteschlange desselben Servers übernehmen: Titel-IDs sind dort gültig.
    if (session !== client() || revision !== queueRevision || !playback().rememberQueue) return;
    if (!saved || saved.serverUrl !== creds.serverUrl || saved.username !== creds.username || !Array.isArray(saved.queue)) return;
    if (!saved.queue.every(isSong)) return;
    const queue = saved.queue;
    if (!queue.length) return;
    const index = clampIndex(saved.index, queue.length);
    const order = saved.unshuffled;
    const validOrder = Array.isArray(order) && order.length === queue.length && new Set(order).size === queue.length && order.every((i) => Number.isInteger(i) && i >= 0 && i < queue.length);
    const position = typeof saved.position === "number" && Number.isFinite(saved.position) ? Math.max(0, saved.position) : 0;
    set({ queue, index, shuffle: Boolean(saved.shuffle), unshuffled: validOrder ? order.map((i) => queue[i]) : null, repeat: repeatOrder.includes(saved.repeat) ? saved.repeat : "off" });
    load(index, { autoplay: false, position });
  },

  async flush() {
    cancelSave();
    await saveNow();
    await flushWrites();
  },
}));

// --- Verknüpfungen ------------------------------------------------------

useSession.subscribe((session, previous) => {
  if (session.client === previous.client) return;
  // Beim App-Start die Ablage behalten; bei Abmeldung/Kontowechsel verwerfen.
  usePlayer.getState().reset(Boolean(previous.client));
  void usePlayer.getState().restore();
});

useSettings.subscribe((state, previous) => {
  const now = state.settings;
  const before = previous.settings;
  if (now.rememberQueue !== before.rememberQueue) {
    cancelSave();
    if (now.rememberQueue) void saveNow();
    else void removeValue(FILE, KEY).catch(() => {});
  }
  if (now.gapless !== before.gapless) preloadNext();
  if (now.maxBitRate !== before.maxBitRate || now.format !== before.format) {
    // Neue Qualität gilt sofort: den laufenden Titel an derselben Stelle neu laden.
    const { index, position } = usePlayer.getState();
    if (index >= 0) reload(index, position, wantsPlayback);
    return;
  }
  if (now.replayGain !== before.replayGain) {
    const { queue, index } = usePlayer.getState();
    applyVolume(queue[index]);
  }
});

if ("mediaSession" in navigator) {
  const player = () => usePlayer.getState();
  navigator.mediaSession.setActionHandler("play", () => player().play());
  navigator.mediaSession.setActionHandler("pause", () => player().pause());
  navigator.mediaSession.setActionHandler("nexttrack", () => player().next());
  navigator.mediaSession.setActionHandler("previoustrack", () => player().prev());
  navigator.mediaSession.setActionHandler("seekto", (details) => details.seekTime != null && player().seek(details.seekTime));
  navigator.mediaSession.setActionHandler("stop", () => player().clearQueue());
}

// Netzwechsel: anhalten, wenn nichts mehr geht, und wieder anlaufen, sobald es geht.
window.addEventListener("offline", () => {
  if (wantsPlayback && usePlayer.getState().index >= 0) usePlayer.setState({ buffering: true });
});

window.addEventListener("online", () => {
  const { index, position, buffering, error } = usePlayer.getState();
  if (index >= 0 && wantsPlayback && (buffering || error)) reload(index, position, true);
});

// Beim Verstecken sofort schreiben: der Zeitgeber könnte sonst ausfallen.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void saveNow();
});

applyVolume(usePlayer.getState().queue[usePlayer.getState().index]);



