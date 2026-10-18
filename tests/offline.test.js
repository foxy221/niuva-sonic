import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { SubsonicClient } from "../src/api/subsonic";
import { defaultSettings, mergeSettings } from "../src/state/settings";
import { useOffline } from "../src/state/offline";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";
import { useSettings } from "../src/state/settings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

const creds = { serverUrl: "https://nav.example", username: "henrik", token: "tok", salt: "salt" };
const song = (id, extra = {}) => ({
  id,
  title: `Titel ${id}`,
  artist: "Künstlerin",
  album: "Album",
  albumId: "al-1",
  duration: 200,
  suffix: "flac",
  size: 1000,
  ...extra,
});

/** In-Memory-Store für `plugin-store`; `restoreAllMocks` wischt Implementierungen. */
const files = new Map();
function implementMocks() {
  vi.mocked(convertFileSrc).mockImplementation((path) => `http://asset.localhost/${encodeURIComponent(path)}`);
  vi.mocked(load).mockImplementation(async (file) => {
    if (!files.has(file)) files.set(file, new Map());
    const map = files.get(file);
    return {
      set: async (key, value) => { map.set(key, value); },
      get: async (key) => map.get(key) ?? null,
      delete: async (key) => { map.delete(key); },
      save: async () => {},
    };
  });
}

/** Standardantworten der Hülle; einzelne Tests überschreiben gezielt. */
let diskUsage = 0;
const invokeDefault = async (command, args) => {
  switch (command) {
    case "offline_base_dir": return "C:/AppData/offline";
    case "offline_disk_usage": return diskUsage;
    case "download_file": return { path: `C:/AppData/offline/${args.relPath}`, size: 1000 };
    case "cancel_download": return true;
    case "delete_offline_file": return null;
    case "clear_offline": return diskUsage;
    default: throw new Error(`Unerwarteter Befehl: ${command}`);
  }
};

async function settle() {
  await vi.waitFor(() => {
    expect(useOffline.getState().jobs.every((job) => job.state !== "running")).toBe(true);
  });
}

async function libraryKey() {
  const { md5 } = await import("js-md5");
  return `library-${md5(`${creds.serverUrl}|${creds.username}`).slice(0, 12)}`;
}

/** Meldet die Sitzung an und wartet, bis der dadurch angestoßene Wiederherstellungslauf fertig ist. */
async function signIn() {
  useSession.setState({ ready: true, creds, client: new SubsonicClient(creds) });
  await useOffline.getState().restore();
}

beforeEach(() => {
  window.__TAURI_INTERNALS__ = {};
  files.clear();
  diskUsage = 0;
  implementMocks();
  vi.mocked(invoke).mockImplementation(invokeDefault);
  useOffline.setState({ ready: false, songs: {}, albums: {}, jobs: [], baseDir: null, usage: null });
  useSettings.setState({ settings: { ...defaultSettings } });
  usePlayer.getState().reset(false);
});

afterEach(() => {
  delete window.__TAURI_INTERNALS__;
});

describe("Offline-Ablage", () => {
  it("stellt beim Start Wurzelverzeichnis, Index und Belegung bereit", async () => {
    files.set("offline.json", new Map([[await libraryKey(), {
      serverUrl: creds.serverUrl,
      username: creds.username,
      songs: { "mf-1": { song: song("mf-1"), rel: "abc/mf-1.flac", size: 5, at: 1 } },
      albums: {},
    }]]));
    await signIn();

    const state = useOffline.getState();
    expect(state.ready).toBe(true);
    expect(state.baseDir).toBe("C:/AppData/offline");
    expect(state.has("mf-1")).toBe(true);
    expect(state.sourceFor("mf-1")).toMatch(/^http:\/\/asset\.localhost\//);
    await vi.waitFor(() => expect(useOffline.getState().usage).toBe(0));
  });

  it("liefert ohne Tauri-Hülle keine lokalen Quellen", async () => {
    delete window.__TAURI_INTERNALS__;
    await useOffline.getState().restore();
    expect(useOffline.getState().ready).toBe(true);
    expect(useOffline.getState().sourceFor("mf-1")).toBeNull();
  });

  it("verwirft den Index eines anderen Zugangs", async () => {
    files.set("offline.json", new Map([[await libraryKey(), { serverUrl: "https://woanders", username: "fremd", songs: { x: {} }, albums: {} }]]));
    await signIn();

    expect(useOffline.getState().songs).toEqual({});
  });

  it("lädt Titel und Cover eines Albums und trägt alles ein", async () => {
    await signIn();
    useOffline.setState({ baseDir: "C:/AppData/offline" });
    const album = { id: "al-1", name: "Album", artist: "Künstlerin", coverArt: "al-1", song: [song("mf-1"), song("mf-2")] };

    useOffline.getState().download(album.song, album);
    await settle();

    const state = useOffline.getState();
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({ state: "done", totalCount: 2, doneCount: 2, failedCount: 0 });
    expect(state.has("mf-1")).toBe(true);
    expect(state.has("mf-2")).toBe(true);
    expect(state.albums["al-1"]?.coverRel).toMatch(/covers\/al-1\.jpg$/);
    expect(state.coverSource("al-1")).toMatch(/^http:\/\/asset\.localhost\//);
    // Titel tragen eine eigene Cover-ID (Navidrome: mf-…); ihr lokales Cover gehört zum Album.
    expect(state.coverSource("mf-1", "al-1")).toBe(state.coverSource("al-1"));
    expect(state.coverSource("mf-1", "al-9")).toBeNull();
    // Download-Adresse nutzt `download` mit der Originaldatei.
    const calls = vi.mocked(invoke).mock.calls.filter(([command]) => command === "download_file");
    expect(calls[0][1].url).toContain("/rest/download?");
    expect(calls.some(([, args]) => args.relPath.endsWith("covers/al-1.jpg"))).toBe(true);
    // Der Index liegt persistent.
    const stored = files.get("offline.json");
    expect(stored.get(await libraryKey()).songs["mf-1"].rel).toBe(state.songs["mf-1"].rel);
  });

  it("zählt den Fortschritt über alle Dateien eines Jobs zusammen", async () => {
    await signIn();
    const album = { id: "al-1", name: "Album", artist: "K", song: [song("mf-1"), song("mf-2")] };

    useOffline.getState().download(album.song, album);
    await settle();

    expect(useOffline.getState().jobs[0]).toMatchObject({ totalBytes: 2000, finishedBytes: 2000, receivedBytes: 2000 });
  });

  it("bricht beim Leeren der Ablage laufende Downloads ab", async () => {
    await signIn();
    useOffline.setState({ jobs: [{ id: "job-1", label: "x", songIds: [], totalCount: 1, doneCount: 0, failedCount: 0, totalBytes: 0, finishedBytes: 0, receivedBytes: 0, state: "running" }] });

    await useOffline.getState().clearAll();

    expect(useOffline.getState().jobs[0].state).toBe("canceled");
    expect(invoke).toHaveBeenCalledWith("cancel_download", { jobId: "job-1" });
  });

  it("überspringt bereits vorhandene Titel", async () => {
    await signIn();
    useOffline.setState({ songs: { "mf-1": { song: song("mf-1"), rel: "k/mf-1.flac", size: 1, at: 1 } } });
    const album = { id: "al-1", name: "Album", coverArt: "al-1", song: [song("mf-1"), song("mf-2")] };

    useOffline.getState().download(album.song, album);
    await settle();

    const titleDownloads = vi.mocked(invoke).mock.calls.filter(
      ([command, args]) => command === "download_file" && !args.relPath.includes("covers"),
    );
    expect(titleDownloads).toHaveLength(1);
    expect(titleDownloads[0][1].relPath).toContain("mf-2");
    expect(useOffline.getState().jobs[0].doneCount).toBe(2);
    expect(useOffline.getState().songs["mf-1"].rel).toBe("k/mf-1.flac");
  });

  it("zählt fehlgeschlagene Titel und hält den Job am Laufen", async () => {
    await signIn();
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "download_file" && args.relPath.includes("mf-1")) throw "Netzwerkfehler";
      return invokeDefault(command, args);
    });

    useOffline.getState().download([song("mf-1"), song("mf-2")]);
    await settle();

    expect(useOffline.getState().jobs[0]).toMatchObject({ state: "done", doneCount: 1, failedCount: 1 });
    expect(useOffline.getState().has("mf-2")).toBe(true);
  });

  it("meldet Fehler, wenn kein Titel klappt", async () => {
    await signIn();
    vi.mocked(invoke).mockRejectedValue("Server überlastet");

    useOffline.getState().download([song("mf-1")]);
    await settle();

    expect(useOffline.getState().jobs[0]).toMatchObject({ state: "error" });
    expect(useOffline.getState().jobs[0].error).toContain("Kein Titel");
  });

  it("bricht ab und behält bereits geladene Titel", async () => {
    await signIn();
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command === "download_file" && args.relPath.includes("mf-2")) throw "Download abgebrochen.";
      return invokeDefault(command, args);
    });

    useOffline.getState().download([song("mf-1"), song("mf-2"), song("mf-3")]);
    await settle();

    expect(useOffline.getState().jobs[0].state).toBe("canceled");
    expect(useOffline.getState().has("mf-1")).toBe(true);
    expect(useOffline.getState().has("mf-3")).toBe(false);
  });

  it("stoppt neue Downloads am Speicherlimit", async () => {
    await signIn();
    useSettings.setState({ settings: { ...defaultSettings, offlineLimitGb: 1 } });
    diskUsage = 1_000_000_000;

    useOffline.getState().download([song("mf-1")]);
    await settle();

    expect(useOffline.getState().jobs[0].state).toBe("error");
    expect(useOffline.getState().jobs[0].error).toContain("Speicherlimit");
    expect(vi.mocked(invoke).mock.calls.some(([command]) => command === "download_file")).toBe(false);
  });

  it("meldet einen Abbruch an die Hülle", () => {
    useOffline.setState({ jobs: [{ id: "job-1", label: "x", songIds: [], totalCount: 1, doneCount: 0, failedCount: 0, totalBytes: 0, finishedBytes: 0, receivedBytes: 0, state: "running" }] });

    useOffline.getState().cancel("job-1");

    expect(useOffline.getState().jobs[0].state).toBe("canceled");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("cancel_download", { jobId: "job-1" });
  });

  it("entfernt Titel, Album und ganze Ablage", async () => {
    await signIn();
    useOffline.setState({
      songs: {
        "mf-1": { song: song("mf-1"), rel: "k/mf-1.flac", size: 1, at: 1 },
        "mf-2": { song: song("mf-2", { albumId: "al-9" }), rel: "k/mf-2.flac", size: 1, at: 2 },
      },
      albums: { "al-9": { album: { id: "al-9", name: "Weg", song: [] }, coverRel: "k/covers/al-9.jpg" } },
    });

    await useOffline.getState().removeSong("mf-1");
    expect(useOffline.getState().has("mf-1")).toBe(false);
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("delete_offline_file", { relPath: "k/mf-1.flac" });

    await useOffline.getState().removeAlbum("al-9");
    expect(useOffline.getState().albums).toEqual({});
    expect(useOffline.getState().has("mf-2")).toBe(false);
    const deleted = vi.mocked(invoke).mock.calls.filter(([command]) => command === "delete_offline_file").map(([, args]) => args.relPath);
    expect(deleted).toEqual(expect.arrayContaining(["k/mf-1.flac", "k/mf-2.flac", "k/covers/al-9.jpg"]));

    await useOffline.getState().clearAll();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("clear_offline");
    expect(useOffline.getState().songs).toEqual({});
  });
});

describe("Wiedergabe aus der Offline-Ablage", () => {
  it("spielt einen vorhandenen Titel aus der lokalen Datei", async () => {
    await signIn();
    useOffline.setState({
      baseDir: "C:/AppData/offline",
      songs: { "mf-1": { song: song("mf-1"), rel: "abc/mf-1.flac", size: 5, at: 1 } },
    });

    usePlayer.getState().playQueue([song("mf-1")], 0);
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true));

    expect(Audio.instances.some((el) => /^http:\/\/asset\.localhost\//.test(el.src))).toBe(true);
  });

  it("streamt ohne lokalen Titel vom Server", async () => {
    await signIn();

    usePlayer.getState().playQueue([song("mf-9")], 0);
    await vi.waitFor(() => expect(usePlayer.getState().playing).toBe(true));

    expect(Audio.instances.some((el) => el.src.includes("/rest/stream?"))).toBe(true);
  });
});

describe("Einstellungen", () => {
  it("nimmt das Speicherlimit nur als endliche Zahl ab null", () => {
    expect(mergeSettings({ offlineLimitGb: 20 }).offlineLimitGb).toBe(20);
    expect(mergeSettings({ offlineLimitGb: -3 }).offlineLimitGb).toBe(0);
    expect(mergeSettings({ offlineLimitGb: "viel" }).offlineLimitGb).toBe(0);
    expect(mergeSettings({}).offlineLimitGb).toBe(0);
  });
});
