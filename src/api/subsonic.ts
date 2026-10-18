import { md5 } from "js-md5";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Album, AlbumListType, AlbumWithSongs, Artist, Credentials } from "./types";

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

export class SubsonicClient {
  constructor(private creds: Credentials) {}

  private params(extra: Record<string, string | number | undefined> = {}) {
    const p = new URLSearchParams({
      u: this.creds.username,
      t: this.creds.token,
      s: this.creds.salt,
      v: API_VERSION,
      c: CLIENT_NAME,
      f: "json",
    });
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) p.set(k, String(v));
    return p;
  }

  private url(endpoint: string, extra?: Record<string, string | number | undefined>) {
    return `${this.creds.serverUrl}/rest/${endpoint}?${this.params(extra)}`;
  }

  private async call<T>(endpoint: string, extra?: Record<string, string | number | undefined>): Promise<T> {
    const res = await httpFetch(this.url(endpoint, extra));
    if (!res.ok) throw new SubsonicError(res.status, `Server antwortet mit HTTP ${res.status}`);
    const body = (await res.json())["subsonic-response"];
    if (body?.status !== "ok") throw new SubsonicError(body?.error?.code ?? 0, body?.error?.message ?? "Unbekannter Fehler");
    return body as T;
  }

  ping() {
    return this.call<{ type?: string; serverVersion?: string }>("ping");
  }

  async getArtists(): Promise<Artist[]> {
    const r = await this.call<{ artists: { index: { artist: Artist[] }[] } }>("getArtists");
    return r.artists.index.flatMap((i) => i.artist);
  }

  async getAlbumList(type: AlbumListType, size = 30, offset = 0): Promise<Album[]> {
    const r = await this.call<{ albumList2: { album?: Album[] } }>("getAlbumList2", { type, size, offset });
    return r.albumList2.album ?? [];
  }

  async getAlbum(id: string): Promise<AlbumWithSongs> {
    return (await this.call<{ album: AlbumWithSongs }>("getAlbum", { id })).album;
  }

  coverArtUrl(id: string, size = 300) {
    return this.url("getCoverArt", { id, size });
  }

  streamUrl(id: string) {
    return this.url("stream", { id });
  }
}
