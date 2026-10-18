import { create } from "zustand";
import { md5 } from "js-md5";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { AlbumWithSongs, Credentials, Song } from "../api/types";
import type { SubsonicClient } from "../api/subsonic";
import {
  cancelDownload,
  clearOffline,
  deleteOfflineFile,
  offlineBaseDir,
  offlineDiskUsage,
  onDownloadProgress,
  startDownload,
} from "./desktop";
import { readValue, writeValue } from "./storage";
import { logError } from "./log";
import { useSession } from "./session";
import { useSettings } from "./settings";

const FILE = "offline.json";

/** Downloads und lokale Wiedergabe brauchen die Tauri-Hülle. */
export const offlineSupported = () => "__TAURI_INTERNALS__" in window;

/** Ein Titel in der Offline-Ablage. */
export interface OfflineSongEntry {
  song: Song;
  /** Pfad relativ zur Ablage-Wurzel. */
  rel: string;
  size: number;
  at: number;
}

/** Ein Album in der Offline-Bibliothek: Metadaten plus lokales Cover. */
export interface OfflineAlbumEntry {
  album: AlbumWithSongs;
  coverRel?: string;
}

interface OfflineLibrary {
  serverUrl: string;
  username: string;
  songs: Record<string, OfflineSongEntry>;
  albums: Record<string, OfflineAlbumEntry>;
}

export interface DownloadJob {
  id: string;
  label: string;
  albumId?: string;
  /** Titel-IDs, die der Job noch laden will; für gesperrte Schaltflächen. */
  songIds: string[];
  totalCount: number;
  doneCount: number;
  failedCount: number;
  totalBytes: number;
  /** Bytes der bereits fertigen Dateien dieses Jobs. */
  finishedBytes: number;
  receivedBytes: number;
  state: "running" | "done" | "canceled" | "error";
  error?: string;
}

interface OfflineState {
  ready: boolean;
  songs: Record<string, OfflineSongEntry>;
  albums: Record<string, OfflineAlbumEntry>;
  jobs: DownloadJob[];
  /** Absolute Wurzel der Ablage; ohne sie gibt es keine lokale Wiedergabe. */
  baseDir: string | null;
  /** Tatsächlich belegte Bytes; `null`, bevor die Messung da ist. */
  usage: number | null;
  restore: () => Promise<void>;
  has: (songId: string) => boolean;
  /** WebView-Adresse der lokalen Datei oder `null`. */
  sourceFor: (songId: string) => string | null;
  /** Lokales Cover zu einer Cover-ID oder `null`. */
  coverSource: (coverArt: string) => string | null;
  download: (songs: Song[], album?: AlbumWithSongs) => void;
  cancel: (jobId: string) => void;
  removeSong: (songId: string) => Promise<void>;
  removeAlbum: (albumId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}

const GB = 1_000_000_000;

/** Titel-IDs sind serverspezifisch; jeder Server bekommt sein Unterverzeichnis. */
function serverKey(creds: Credentials) {
  return md5(`${creds.serverUrl}|${creds.username}`).slice(0, 12);
}

const safeName = (id: string) => id.replace(/[^A-Za-z0-9._-]/g, "_");

function suffixFor(song: Song) {
  const fromType = song.contentType?.split("/")[1];
  return safeName(song.suffix || fromType || "bin").replace(/^\.+/, "");
}

function relForSong(song: Song, key: string) {
  return `${key}/${safeName(song.id)}.${suffixFor(song)}`;
}

function relForCover(coverArt: string, key: string) {
  return `${key}/covers/${safeName(coverArt)}.jpg`;
}

function localSrc(baseDir: string, rel: string) {
  return convertFileSrc([baseDir, rel].join("/").replace(/\\/g, "/"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Beschädigte Einträge verwerfen, statt die ganze Bibliothek zu verlieren. */
function validLibrary(value: unknown): OfflineLibrary | null {
  if (!isRecord(value)) return null;
  if (typeof value.serverUrl !== "string" || typeof value.username !== "string") return null;
  if (!isRecord(value.songs) || !isRecord(value.albums)) return null;
  const songs: Record<string, OfflineSongEntry> = {};
  for (const [id, entry] of Object.entries(value.songs)) {
    if (!isRecord(entry) || !isRecord(entry.song)) continue;
    const song = entry.song as unknown as Song;
    if (typeof song.id !== "string" || typeof song.title !== "string") continue;
    if (typeof entry.rel !== "string" || typeof entry.size !== "number") continue;
    songs[id] = { song, rel: entry.rel, size: entry.size, at: typeof entry.at === "number" ? entry.at : 0 };
  }
  const albums: Record<string, OfflineAlbumEntry> = {};
  for (const [id, entry] of Object.entries(value.albums)) {
    if (!isRecord(entry) || !isRecord(entry.album)) continue;
    const album = entry.album as unknown as AlbumWithSongs;
    if (typeof album.id !== "string" || typeof album.name !== "string") continue;
    if (entry.coverRel !== undefined && typeof entry.coverRel !== "string") continue;
    albums[id] = { album, coverRel: entry.coverRel };
  }
  return { serverUrl: value.serverUrl, username: value.username, songs, albums };
}

let restoreTask: Promise<void> | null = null;
/** Für welchen Zugang der Index gerade geladen ist; bei Wechsel neu laden. */
let loadedFor: string | null = null;
let progressWired = false;

function persist(creds: Credentials) {
  const { songs, albums } = useOffline.getState();
  const library: OfflineLibrary = { serverUrl: creds.serverUrl, username: creds.username, songs, albums };
  return writeValue(FILE, `library-${serverKey(creds)}`, library).catch(() => {});
}

function patchJob(id: string, patch: Partial<DownloadJob>) {
  useOffline.setState({
    jobs: useOffline.getState().jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
  });
}

function limitBytes() {
  const gb = useSettings.getState().settings.offlineLimitGb;
  return gb > 0 ? gb * GB : 0;
}

async function runJob(job: DownloadJob, pending: Song[], album: AlbumWithSongs | undefined, creds: Credentials, client: SubsonicClient) {
  const key = serverKey(creds);
  const bump = (field: "doneCount" | "failedCount") => {
    const current = useOffline.getState().jobs.find((j) => j.id === job.id);
    if (current) patchJob(job.id, { [field]: current[field] + 1 });
  };
  let canceled = false;
  for (const song of pending) {
    if (useOffline.getState().jobs.find((j) => j.id === job.id)?.state !== "running") {
      canceled = true;
      break;
    }
    const limit = limitBytes();
    if (limit > 0) {
      const used = await offlineDiskUsage().catch(() => 0);
      if (used + (song.size ?? 0) > limit) {
        patchJob(job.id, { state: "error", error: "Speicherlimit erreicht. Alte Downloads entfernen oder das Limit in den Einstellungen erhöhen." });
        canceled = true;
        break;
      }
    }
    try {
      const rel = relForSong(song, key);
      const result = await startDownload({ jobId: job.id, url: client.downloadUrl(song.id), relPath: rel });
      useOffline.setState((state) => ({
        songs: { ...state.songs, [song.id]: { song, rel, size: result.size, at: Date.now() } },
      }));
      bump("doneCount");
      const finished = (useOffline.getState().jobs.find((j) => j.id === job.id)?.finishedBytes ?? 0) + result.size;
      patchJob(job.id, { finishedBytes: finished, receivedBytes: finished });
      void persist(creds);
      void useOffline.getState().refreshUsage();
    } catch (error) {
      if (String(error).includes("abgebrochen")) {
        canceled = true;
        break;
      }
      logError(error, `Download fehlgeschlagen: ${song.title}`);
      bump("failedCount");
    }
  }
  // Das Cover gehört zum Album, darf aber fehlen, ohne den Job zu scheitern.
  if (!canceled && album?.coverArt) {
    try {
      const coverRel = relForCover(album.coverArt, key);
      await startDownload({ jobId: job.id, url: client.coverArtUrl(album.coverArt, 500), relPath: coverRel });
      useOffline.setState((state) => ({ albums: { ...state.albums, [album.id]: { album, coverRel } } }));
    } catch {
      useOffline.setState((state) => ({ albums: { ...state.albums, [album.id]: { album } } }));
    }
    void persist(creds);
  }
  const final = useOffline.getState().jobs.find((j) => j.id === job.id);
  if (final && final.state === "running") {
    patchJob(job.id, {
      state: canceled ? "canceled" : final.failedCount > 0 && final.doneCount === 0 ? "error" : "done",
      error: !canceled && final.failedCount > 0 && final.doneCount === 0 ? "Kein Titel konnte geladen werden." : undefined,
    });
  }
  void useOffline.getState().refreshUsage();
}

export const useOffline = create<OfflineState>((set, get) => ({
  ready: false,
  songs: {},
  albums: {},
  jobs: [],
  baseDir: null,
  usage: null,

  async restore() {
    if (!offlineSupported()) {
      set({ ready: true });
      return;
    }
    if (!progressWired) {
      progressWired = true;
      // Fortschrittsereignisse der Hülle in die Jobs schreiben.
      void onDownloadProgress(({ jobId, received }) => {
        const job = useOffline.getState().jobs.find((j) => j.id === jobId);
        // `received` gilt nur für die laufende Datei; fertige Dateien kommen dazu.
        if (job) patchJob(jobId, { receivedBytes: (job.finishedBytes ?? 0) + received });
      }).then((unlisten: UnlistenFn) => {
        // Der Listener lebt so lange wie die App; ein Neuladen entfernt ihn mit der Seite.
        window.addEventListener("beforeunload", unlisten, { once: true });
      });
    }
    const creds = useSession.getState().creds;
    const forKey = creds ? `${creds.serverUrl}|${creds.username}` : null;
    if (restoreTask && loadedFor === forKey) return restoreTask;
    const task = (async () => {
      // Ein Kontowechsel darf laufende Downloads nicht in den fremden Index schreiben lassen.
      if (loadedFor !== forKey) {
        for (const job of get().jobs) if (job.state === "running") get().cancel(job.id);
      }
      if (!creds) {
        loadedFor = null;
        set({ songs: {}, albums: {}, baseDir: null, ready: true });
        return;
      }
      try {
        set({ baseDir: await offlineBaseDir() });
      } catch {
        // Ohne Wurzel gibt es keine lokale Wiedergabe; die App läuft weiter.
      }
      const stored = await readValue<unknown>(FILE, `library-${serverKey(creds)}`).catch(() => null);
      const library = validLibrary(stored);
      set({
        songs: library?.serverUrl === creds.serverUrl && library.username === creds.username ? library.songs : {},
        albums: library?.serverUrl === creds.serverUrl && library.username === creds.username ? library.albums : {},
        ready: true,
      });
      loadedFor = forKey;
      void get().refreshUsage();
    })();
    restoreTask = task.finally(() => {
      restoreTask = null;
    });
    return task;
  },

  has(songId) {
    return Boolean(get().songs[songId]);
  },

  sourceFor(songId) {
    const entry = get().songs[songId];
    const base = get().baseDir;
    if (!entry || !base || !offlineSupported()) return null;
    return localSrc(base, entry.rel);
  },

  coverSource(coverArt) {
    const base = get().baseDir;
    if (!base || !offlineSupported()) return null;
    for (const entry of Object.values(get().albums)) {
      if (entry.album.coverArt === coverArt && entry.coverRel) return localSrc(base, entry.coverRel);
    }
    return null;
  },

  download(songs, album) {
    if (!offlineSupported()) return;
    const { creds, client } = useSession.getState();
    if (!creds || !client || !songs.length) return;
    const current = get().songs;
    // Schon laufende Jobs für dieselben Titel nicht verdoppeln.
    const running = new Set(get().jobs.filter((j) => j.state === "running").flatMap((j) => j.songIds));
    const pending = songs.filter((song) => !current[song.id] && !running.has(song.id));
    if (!pending.length) {
      // Alles schon da: nur das Album mit Cover nachtragen, falls es fehlt.
      if (album && !get().albums[album.id]) {
        set((state) => ({ albums: { ...state.albums, [album.id]: { album } } }));
        void persist(creds);
      }
      return;
    }
    const job: DownloadJob = {
      id: crypto.randomUUID(),
      label: album?.name ?? (pending.length === 1 ? pending[0].title : `${pending.length} Titel`),
      albumId: album?.id,
      songIds: pending.map((song) => song.id),
      totalCount: songs.length,
      doneCount: songs.length - pending.length,
      failedCount: 0,
      totalBytes: pending.reduce((sum, song) => sum + (song.size ?? 0), 0),
      finishedBytes: 0,
      receivedBytes: 0,
      state: "running",
    };
    set({ jobs: [...get().jobs, job] });
    void runJob(job, pending, album, creds, client);
  },

  cancel(jobId) {
    patchJob(jobId, { state: "canceled" });
    void cancelDownload(jobId).catch(() => {});
  },

  async removeSong(songId) {
    const entry = get().songs[songId];
    const { creds } = useSession.getState();
    if (!entry || !creds) return;
    set((state) => {
      const songs = { ...state.songs };
      delete songs[songId];
      return { songs };
    });
    await persist(creds);
    await deleteOfflineFile(entry.rel).catch(() => {});
    void get().refreshUsage();
  },

  async removeAlbum(albumId) {
    const entry = get().albums[albumId];
    const { creds } = useSession.getState();
    if (!entry || !creds) return;
    const rels = Object.values(get().songs)
      .filter((song) => song.song.albumId === albumId)
      .map((song) => song.rel);
    set((state) => {
      const songs = { ...state.songs };
      for (const [id, song] of Object.entries(songs)) if (song.song.albumId === albumId) delete songs[id];
      const albums = { ...state.albums };
      delete albums[albumId];
      return { songs, albums };
    });
    await persist(creds);
    if (entry.coverRel) rels.push(entry.coverRel);
    await Promise.allSettled(rels.map((rel) => deleteOfflineFile(rel)));
    void get().refreshUsage();
  },

  async clearAll() {
    const { creds } = useSession.getState();
    // Laufende Downloads würden die leere Ablage sofort wieder füllen.
    for (const job of get().jobs) if (job.state === "running") get().cancel(job.id);
    set({ songs: {}, albums: {} });
    if (creds) await persist(creds);
    await clearOffline().catch(() => {});
    void get().refreshUsage();
  },

  async refreshUsage() {
    if (!offlineSupported()) return;
    try {
      set({ usage: await offlineDiskUsage() });
    } catch {
      // Ohne Messung zeigt die Oberfläche keinen Wert statt eines Fehlers.
    }
  },
}));

/** Titel eines Offline-Albums in Plattenreihenfolge. */
export function offlineAlbumSongs(songs: Record<string, OfflineSongEntry>, albumId: string): Song[] {
  return Object.values(songs)
    .filter((entry) => entry.song.albumId === albumId)
    .map((entry) => entry.song)
    .sort((a, b) => (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.track ?? 0) - (b.track ?? 0));
}
