import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { md5 } from "js-md5";
import { SubsonicClient, SubsonicError, createAuth, normalizeServerUrl } from "../src/api/subsonic";

/**
 * Der Client ist die einzige Stelle, die mit dem Server spricht. Geprüft werden
 * Aufbau der Adresse, Auswertung der Antworten und die Fehlerwege – jeweils
 * ohne echten Server über eine nachgestellte `fetch`.
 */

const creds = { serverUrl: "https://nav.example", username: "henrik", token: "t".repeat(32), salt: "salz12345678" };

/** Antwort im Zuschnitt von `fetch`; `json` liefert den Rumpf. */
function respond(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}
const ok = (payload = {}) => respond({ "subsonic-response": { status: "ok", ...payload } });
const failed = (code, message) => respond({ "subsonic-response": { status: "failed", error: { code, message } } });

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const client = () => new SubsonicClient(creds);
/** Zuletzt angefragte Adresse als Objekt, damit Parameter bequem prüfbar sind. */
const lastUrl = () => new URL(fetchMock.mock.calls.at(-1)[0]);
const lastEndpoint = () => lastUrl().pathname.split("/").at(-1);

describe("Adresse und Anmeldung", () => {
  it("ergänzt fehlende Schemata und entfernt Schrägstriche am Ende", () => {
    expect(normalizeServerUrl("musik.example")).toBe("https://musik.example");
    expect(normalizeServerUrl("  http://nav.local:4533/  ")).toBe("http://nav.local:4533");
    expect(normalizeServerUrl("https://nav.example")).toBe("https://nav.example");
  });

  it("erzeugt Salt und Token nach der Subsonic-Regel", () => {
    const { salt, token } = createAuth("geheim");
    expect(salt).toHaveLength(12);
    expect(salt).toMatch(/^[0-9a-f]{12}$/);
    expect(token).toBe(md5("geheim" + salt));
  });

  it("schickt Benutzer, Token, Salt, Fassung, Client und Format mit", () => {
    fetchMock.mockResolvedValue(ok());
    void client().ping();

    const url = lastUrl();
    expect(url.origin + url.pathname).toBe("https://nav.example/rest/ping");
    expect(url.searchParams.get("u")).toBe("henrik");
    expect(url.searchParams.get("t")).toBe(creds.token);
    expect(url.searchParams.get("s")).toBe(creds.salt);
    expect(url.searchParams.get("v")).toBe("1.16.1");
    expect(url.searchParams.get("c")).toBe("niuva-sonic");
    expect(url.searchParams.get("f")).toBe("json");
  });

  it("lässt leere Werte weg und wiederholt Mehrfachwerte", async () => {
    fetchMock.mockResolvedValue(ok());
    await client().star({ id: ["a", "b"], albumId: ["al-1"] });

    expect(lastEndpoint()).toBe("star");
    expect(lastUrl().searchParams.getAll("id")).toEqual(["a", "b"]);
    expect(lastUrl().searchParams.getAll("albumId")).toEqual(["al-1"]);
    expect(lastUrl().searchParams.has("artistId")).toBe(false);
  });
});

describe("Fehlerwege", () => {
  it("meldet einen HTTP-Fehler mit Statuscode", async () => {
    fetchMock.mockResolvedValue(respond({}, { ok: false, status: 502 }));
    await expect(client().ping()).rejects.toThrow(SubsonicError);
    fetchMock.mockResolvedValue(respond({}, { ok: false, status: 502 }));
    await expect(client().ping()).rejects.toMatchObject({ code: 502 });
  });

  it("nimmt Code und Text aus der Serverantwort", async () => {
    fetchMock.mockResolvedValue(failed(40, "Wrong username or password"));
    await expect(client().ping()).rejects.toMatchObject({ code: 40, message: "Wrong username or password" });
  });

  it("nutzt einen Ersatztext, wenn der Server keinen nennt", async () => {
    fetchMock.mockResolvedValue(respond({ "subsonic-response": { status: "failed" } }));
    await expect(client().ping()).rejects.toMatchObject({ code: 0, message: "Unbekannter Fehler" });
  });

  it("reicht einen Netzwerkfehler durch", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    await expect(client().ping()).rejects.toThrow("fetch failed");
  });
});

describe("Bibliothek", () => {
  it("ergänzt fehlende Listen, statt zu scheitern", async () => {
    fetchMock.mockResolvedValue(ok({ artists: { index: [{ name: "A" }, { name: "B", artist: [{ id: "1", name: "B1" }] }] } }));
    expect(await client().getArtistIndexes()).toEqual([{ name: "A", artist: [] }, { name: "B", artist: [{ id: "1", name: "B1" }] }]);
  });

  it("liefert Künstler flach in Serverreihenfolge", async () => {
    fetchMock.mockResolvedValue(ok({ artists: { index: [{ name: "A", artist: [{ id: "1", name: "A1" }] }, { name: "B", artist: [{ id: "2", name: "B1" }] }] } }));
    expect((await client().getArtists()).map((a) => a.id)).toEqual(["1", "2"]);
    expect(lastEndpoint()).toBe("getArtists");
  });

  it("holt Künstler, Album und Künstlerinfo", async () => {
    fetchMock.mockResolvedValue(ok({ artist: { id: "1", name: "A", album: [] } }));
    expect(await client().getArtist("1")).toMatchObject({ id: "1" });
    expect(lastUrl().searchParams.get("id")).toBe("1");

    fetchMock.mockResolvedValue(ok({ artistInfo2: { biography: "Text" } }));
    expect(await client().getArtistInfo2("1", 5)).toEqual({ biography: "Text" });
    expect(lastUrl().searchParams.get("count")).toBe("5");

    fetchMock.mockResolvedValue(ok({ album: { id: "al-1", name: "Album", song: [] } }));
    expect(await client().getAlbum("al-1")).toMatchObject({ name: "Album" });
    expect(lastEndpoint()).toBe("getAlbum");
  });

  it("gibt bei fehlenden Feldern leere Werte zurück", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(await client().getArtistInfo2("1")).toEqual({});
    expect(await client().getGenres()).toEqual([]);
    expect(await client().getRandomSongs()).toEqual([]);
    expect(await client().getSongsByGenre("Rock")).toEqual([]);
    expect(await client().getStarred2()).toEqual({});
    expect(await client().getPlaylists()).toEqual([]);
  });

  it("übergibt Albumliste mit Typ, Seite und Zusatzfiltern", async () => {
    fetchMock.mockResolvedValue(ok({ albumList2: { album: [{ id: "al-1", name: "A" }] } }));
    const albums = await client().getAlbumList("byYear", 20, 40, { fromYear: 1990, toYear: 1999 });

    expect(albums).toHaveLength(1);
    const params = lastUrl().searchParams;
    expect(params.get("type")).toBe("byYear");
    expect(params.get("size")).toBe("20");
    expect(params.get("offset")).toBe("40");
    expect(params.get("fromYear")).toBe("1990");
    expect(params.get("toYear")).toBe("1999");
  });

  it("liefert Genres und Titel eines Genres", async () => {
    fetchMock.mockResolvedValue(ok({ genres: { genre: [{ value: "Rock", songCount: 3 }] } }));
    expect(await client().getGenres()).toEqual([{ value: "Rock", songCount: 3 }]);

    fetchMock.mockResolvedValue(ok({ songsByGenre: { song: [{ id: "s-1", title: "T" }] } }));
    expect(await client().getSongsByGenre("Rock", 10, 5)).toHaveLength(1);
    expect(lastUrl().searchParams.get("genre")).toBe("Rock");
    expect(lastUrl().searchParams.get("count")).toBe("10");
    expect(lastUrl().searchParams.get("offset")).toBe("5");
  });

  it("setzt und entfernt Favoriten getrennt nach Typ", async () => {
    fetchMock.mockResolvedValue(ok());
    await client().unstar({ artistId: ["ar-1"] });
    expect(lastEndpoint()).toBe("unstar");
    expect(lastUrl().searchParams.getAll("artistId")).toEqual(["ar-1"]);
    expect(lastUrl().searchParams.has("id")).toBe(false);
  });
});

describe("Playlists", () => {
  it("holt Liste und Inhalt", async () => {
    fetchMock.mockResolvedValue(ok({ playlists: { playlist: [{ id: "pl-1", name: "Mix" }] } }));
    expect(await client().getPlaylists()).toEqual([{ id: "pl-1", name: "Mix" }]);

    fetchMock.mockResolvedValue(ok({ playlist: { id: "pl-1", name: "Mix", entry: [{ id: "s-1", title: "T" }] } }));
    expect((await client().getPlaylist("pl-1")).entry).toHaveLength(1);
    expect(lastUrl().searchParams.get("id")).toBe("pl-1");
  });

  it("legt an und verträgt eine Antwort ohne Playlist", async () => {
    fetchMock.mockResolvedValue(ok({ playlist: { id: "pl-2", name: "Neu" } }));
    expect(await client().createPlaylist({ name: "Neu", songIds: ["s-1", "s-2"] })).toMatchObject({ id: "pl-2" });
    expect(lastUrl().searchParams.getAll("songId")).toEqual(["s-1", "s-2"]);

    fetchMock.mockResolvedValue(ok({}));
    expect(await client().createPlaylist({ name: "Neu" })).toBeNull();
  });

  it("ändert und löscht mit den Parametern der API", async () => {
    fetchMock.mockResolvedValue(ok());
    await client().updatePlaylist({
      playlistId: "pl-1",
      name: "Anders",
      comment: "Notiz",
      public: false,
      songIdsToAdd: ["s-9"],
      songIndexesToRemove: [0, 2],
    });

    const params = lastUrl().searchParams;
    expect(lastEndpoint()).toBe("updatePlaylist");
    expect(params.get("playlistId")).toBe("pl-1");
    expect(params.get("name")).toBe("Anders");
    expect(params.get("comment")).toBe("Notiz");
    expect(params.get("public")).toBe("false");
    expect(params.getAll("songIdToAdd")).toEqual(["s-9"]);
    expect(params.getAll("songIndexToRemove")).toEqual(["0", "2"]);

    await client().deletePlaylist("pl-1");
    expect(lastEndpoint()).toBe("deletePlaylist");
    expect(lastUrl().searchParams.get("id")).toBe("pl-1");
  });
});

describe("Suche und Adressen", () => {
  it("sucht mit Vorgabewerten", async () => {
    fetchMock.mockResolvedValue(ok({ searchResult3: { song: [{ id: "s-1", title: "T" }] } }));
    const result = await client().search3("schiller");

    expect(result.song).toHaveLength(1);
    const params = lastUrl().searchParams;
    expect(params.get("query")).toBe("schiller");
    expect(params.get("artistCount")).toBe("10");
    expect(params.get("albumCount")).toBe("10");
    expect(params.get("songCount")).toBe("20");
    expect(params.get("songOffset")).toBe("0");
  });

  it("nimmt eigene Grenzen an und liefert ohne Treffer ein leeres Ergebnis", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(await client().search3("x", { songCount: 5, albumOffset: 10 })).toEqual({});
    expect(lastUrl().searchParams.get("songCount")).toBe("5");
    expect(lastUrl().searchParams.get("albumOffset")).toBe("10");
  });

  it("baut Cover-, Stream- und Downloadadresse", () => {
    const url = (value) => new URL(value);
    const cover = url(client().coverArtUrl("mf-1", 64));
    expect(cover.pathname).toBe("/rest/getCoverArt");
    expect(cover.searchParams.get("id")).toBe("mf-1");
    expect(cover.searchParams.get("size")).toBe("64");

    const original = url(client().streamUrl("mf-1"));
    expect(original.searchParams.has("maxBitRate")).toBe(false);
    expect(original.searchParams.has("format")).toBe(false);

    const transcoded = url(client().streamUrl("mf-1", { maxBitRate: 128, format: "opus" }));
    expect(transcoded.searchParams.get("maxBitRate")).toBe("128");
    expect(transcoded.searchParams.get("format")).toBe("opus");

    expect(url(client().downloadUrl("mf-1")).pathname).toBe("/rest/download");
  });

  it("meldet Wiedergaben mit Kennzeichnung", async () => {
    fetchMock.mockResolvedValue(ok());
    await client().scrobble({ id: "mf-1", submission: true, time: 1700 });

    const params = lastUrl().searchParams;
    expect(lastEndpoint()).toBe("scrobble");
    expect(params.get("id")).toBe("mf-1");
    expect(params.get("submission")).toBe("true");
    expect(params.get("time")).toBe("1700");
  });
});

describe("OpenSubsonic-Erweiterungen", () => {
  it("liefert Kennung und Fähigkeiten aus der Antwort", async () => {
    fetchMock.mockResolvedValue(ok({ type: "navidrome", serverVersion: "0.64.2", openSubsonic: true }));
    expect(await client().ping()).toMatchObject({ type: "navidrome", openSubsonic: true });

    fetchMock.mockResolvedValue(ok({ openSubsonicExtensions: [{ name: "songLyrics", versions: [1, 2] }, { name: "formPost" }] }));
    expect(await client().getOpenSubsonicExtensions()).toEqual([
      { name: "songLyrics", versions: [1, 2] },
      { name: "formPost", versions: [] },
    ]);
    expect(lastEndpoint()).toBe("getOpenSubsonicExtensions");
  });

  it("liefert ohne Erweiterungen eine leere Liste", async () => {
    fetchMock.mockResolvedValue(ok({}));
    expect(await client().getOpenSubsonicExtensions()).toEqual([]);
  });
});
