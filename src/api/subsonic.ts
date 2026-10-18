import { t } from "../i18n";
import { md5 } from "js-md5";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type {
  Album,
  AlbumListType,
  AlbumWithSongs,
  Artist,
  ArtistIndex,
  ArtistInfo,
  ArtistWithAlbums,
  Credentials,
  Genre,
  OpenSubsonicExtension,
  Playlist,
  PlaylistWithSongs,
  SearchResult3,
  ServerInfo,
  Song,
  StarIds,
  StructuredLyrics,
  Starred,
  StreamOptions,
} from "./types";

const API_VERSION = "1.16.1";
const CLIENT_NAME = "niuva-sonic";

export class SubsonicError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

const isTauri = () => "__TAURI_INTERNALS__" in window;
const httpFetch: typeof fetch = (input, init) => (isTauri() ? tauriFetch(input as string, init) : fetch(input, init));

export function normalizeServerUrl(raw: string) {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export function createAuth(password: string) {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return { salt, token: md5(password + salt) };
}

/** Subsonic überträgt Mehrfachwerte (z. B. `id` bei `star`) als wiederholten Parameter. */
export type ParamValue = string | number | boolean | undefined | Array<string | number>;
type Params = Record<string, ParamValue>;

export class SubsonicClient {
  constructor(private creds: Credentials) {}

  private params(extra: Params = {}) {
    const p = new URLSearchParams({
      u: this.creds.username,
      t: this.creds.token,
      s: this.creds.salt,
      v: API_VERSION,
      c: CLIENT_NAME,
      f: "json",
    });
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) for (const item of v) p.append(k, String(item));
      else p.set(k, String(v));
    }
    return p;
  }

  private url(endpoint: string, extra?: Params) {
    return `${this.creds.serverUrl}/rest/${endpoint}?${this.params(extra)}`;
  }

  private async call<T>(endpoint: string, extra?: Params): Promise<T> {
    const res = await httpFetch(this.url(endpoint, extra));
    if (!res.ok) throw new SubsonicError(res.status, t("api.http", { status: res.status }));
    const body = (await res.json())["subsonic-response"];
    if (body?.status !== "ok") throw new SubsonicError(body?.error?.code ?? 0, body?.error?.message ?? t("api.unknown"));
    return body as T;
  }

  /** Kennung des Servers. `openSubsonic` sagt, ob Erweiterungen abfragbar sind. */
  ping() {
    return this.call<ServerInfo>("ping");
  }

  /**
   * Vom Server gemeldete OpenSubsonic-Erweiterungen. Server ohne OpenSubsonic
   * kennen den Aufruf nicht; der Aufrufer fragt ihn nur nach `ping` mit
   * gesetztem `openSubsonic` ab.
   */
  async getOpenSubsonicExtensions(): Promise<OpenSubsonicExtension[]> {
    const r = await this.call<{ openSubsonicExtensions?: OpenSubsonicExtension[] }>("getOpenSubsonicExtensions");
    return (r.openSubsonicExtensions ?? []).map((entry) => ({ name: entry.name, versions: entry.versions ?? [] }));
  }

  // --- Bibliothek -------------------------------------------------------

  /** Künstler nach Buchstaben gruppiert, wie der Server sie liefert. */
  async getArtistIndexes(): Promise<ArtistIndex[]> {
    const r = await this.call<{ artists: { index?: ArtistIndex[] } }>("getArtists");
    return (r.artists.index ?? []).map((i) => ({ name: i.name, artist: i.artist ?? [] }));
  }

  /** Alle Künstler als flache Liste, in der Reihenfolge des Servers. */
  async getArtists(): Promise<Artist[]> {
    return (await this.getArtistIndexes()).flatMap((i) => i.artist);
  }

  /** Künstler mit Diskografie. */
  async getArtist(id: string): Promise<ArtistWithAlbums> {
    return (await this.call<{ artist: ArtistWithAlbums }>("getArtist", { id })).artist;
  }

  /** Biografie und ähnliche Künstler. */
  async getArtistInfo2(id: string, count = 10): Promise<ArtistInfo> {
    const r = await this.call<{ artistInfo2?: ArtistInfo }>("getArtistInfo2", { id, count });
    return r.artistInfo2 ?? {};
  }

  async getAlbumList(
    type: AlbumListType,
    size = 30,
    offset = 0,
    extra: { fromYear?: number; toYear?: number; genre?: string } = {},
  ): Promise<Album[]> {
    const r = await this.call<{ albumList2: { album?: Album[] } }>("getAlbumList2", { type, size, offset, ...extra });
    return r.albumList2.album ?? [];
  }

  async getAlbum(id: string): Promise<AlbumWithSongs> {
    return (await this.call<{ album: AlbumWithSongs }>("getAlbum", { id })).album;
  }

  async getGenres(): Promise<Genre[]> {
    const r = await this.call<{ genres?: { genre?: Genre[] } }>("getGenres");
    return r.genres?.genre ?? [];
  }

  async getSongsByGenre(genre: string, count = 50, offset = 0): Promise<Song[]> {
    const r = await this.call<{ songsByGenre?: { song?: Song[] } }>("getSongsByGenre", { genre, count, offset });
    return r.songsByGenre?.song ?? [];
  }

  async getRandomSongs(size = 50, genre?: string): Promise<Song[]> {
    const r = await this.call<{ randomSongs?: { song?: Song[] } }>("getRandomSongs", { size, genre });
    return r.randomSongs?.song ?? [];
  }

  /** Beliebteste Titel eines Künstlers (Navidrome braucht dafür die Last.fm-Anbindung). */
  async getTopSongs(artist: string, count = 10): Promise<Song[]> {
    const r = await this.call<{ topSongs?: { song?: Song[] } }>("getTopSongs", { artist, count });
    return r.topSongs?.song ?? [];
  }

  /** Songtexte (OpenSubsonic `songLyrics`); leer, wenn der Titel keinen hat. */
  async getLyricsBySongId(id: string): Promise<StructuredLyrics[]> {
    const r = await this.call<{ lyricsList?: { structuredLyrics?: StructuredLyrics[] } }>("getLyricsBySongId", { id });
    return (r.lyricsList?.structuredLyrics ?? []).map((entry) => ({ ...entry, synced: Boolean(entry.synced), line: entry.line ?? [] }));
  }

  // --- Favoriten --------------------------------------------------------

  async getStarred2(): Promise<Starred> {
    const r = await this.call<{ starred2?: Starred }>("getStarred2");
    return r.starred2 ?? {};
  }

  star(ids: StarIds) {
    return this.call<unknown>("star", ids);
  }

  unstar(ids: StarIds) {
    return this.call<unknown>("unstar", ids);
  }

  // --- Playlists --------------------------------------------------------

  async getPlaylists(): Promise<Playlist[]> {
    const r = await this.call<{ playlists?: { playlist?: Playlist[] } }>("getPlaylists");
    return r.playlists?.playlist ?? [];
  }

  async getPlaylist(id: string): Promise<PlaylistWithSongs> {
    return (await this.call<{ playlist: PlaylistWithSongs }>("getPlaylist", { id })).playlist;
  }

  /** Legt eine Playlist an. Der Server darf ohne `playlist`-Element antworten. */
  async createPlaylist(input: { name: string; playlistId?: string; songIds?: string[] }): Promise<Playlist | null> {
    const r = await this.call<{ playlist?: Playlist }>("createPlaylist", {
      name: input.name,
      playlistId: input.playlistId,
      songId: input.songIds,
    });
    return r.playlist ?? null;
  }

  async updatePlaylist(input: {
    playlistId: string;
    name?: string;
    comment?: string;
    public?: boolean;
    songIdsToAdd?: string[];
    songIndexesToRemove?: number[];
  }) {
    return this.call<unknown>("updatePlaylist", {
      playlistId: input.playlistId,
      name: input.name,
      comment: input.comment,
      public: input.public,
      songIdToAdd: input.songIdsToAdd,
      songIndexToRemove: input.songIndexesToRemove,
    });
  }

  async deletePlaylist(id: string) {
    return this.call<unknown>("deletePlaylist", { id });
  }

  // --- Suche ------------------------------------------------------------

  async search3(
    query: string,
    options: {
      artistCount?: number;
      artistOffset?: number;
      albumCount?: number;
      albumOffset?: number;
      songCount?: number;
      songOffset?: number;
    } = {},
  ): Promise<SearchResult3> {
    const { artistCount = 10, artistOffset = 0, albumCount = 10, albumOffset = 0, songCount = 20, songOffset = 0 } = options;
    const r = await this.call<{ searchResult3?: SearchResult3 }>("search3", {
      query,
      artistCount,
      artistOffset,
      albumCount,
      albumOffset,
      songCount,
      songOffset,
    });
    return r.searchResult3 ?? {};
  }

  // --- URLs -------------------------------------------------------------

  coverArtUrl(id: string, size = 300) {
    return this.url("getCoverArt", { id, size });
  }

  /**
   * Adresse der Audiodatei. Mit `maxBitRate` und `format` transkodiert der Server
   * (gegen Navidrome geprüft: Bitrate greift, `format` ändert den Inhaltstyp).
   * Springen funktioniert auch bei Transcoding, der Server beantwortet
   * Bereichsanfragen mit HTTP 206.
   */
  streamUrl(id: string, options: StreamOptions = {}) {
    const { maxBitRate = 0, format = "" } = options;
    return this.url("stream", {
      id,
      maxBitRate: maxBitRate > 0 ? maxBitRate : undefined,
      format: format || undefined,
    });
  }

  /**
   * Adresse der unveränderten Originaldatei. Für Wiedergabe gilt `streamUrl`,
   * für die Offline-Ablage `downloadUrl`: dort soll genau das landen, was der
   * Server gespeichert hat, ohne Transcoding.
   */
  downloadUrl(id: string) {
    return this.url("download", { id });
  }

  /**
   * Wiedergabe melden: `submission=false` heißt „läuft jetzt“, `true` zählt die
   * Wiedergabe beim Server. `time` ist der Startzeitpunkt in Millisekunden.
   */
  scrobble(input: { id: string; submission?: boolean; time?: number }) {
    return this.call<unknown>("scrobble", { id: input.id, submission: input.submission, time: input.time });
  }
}
