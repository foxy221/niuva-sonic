import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { load } from "@tauri-apps/plugin-store";
import { SubsonicClient } from "../src/api/subsonic";
import { useSession } from "../src/state/session";
import { queryClient } from "../src/state/queryClient";
import { usePlayer } from "../src/state/player";
import { deferred } from "./setup";

vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));

const credentials = { serverUrl: "https://music-a.example", username: "A", token: "a".repeat(32), salt: "salt" };

beforeEach(() => {
  localStorage.clear();
  useSession.setState({ ready: false, creds: null, client: null });
  queryClient.clear();
});

afterEach(() => { delete window.__TAURI_INTERNALS__; });

describe("Sitzungswechsel (#1, #2)", () => {
  it.each([
    ["https://music-a.example", "B"],
    ["https://music-b.example", "A"],
  ])("isoliert Bibliotheksdaten beim Wechsel zu %s / %s", async (server, user) => {
    useSession.setState({ creds: credentials, client: new SubsonicClient(credentials) });
    queryClient.setQueryData(["playlists"], [{ id: "private-A" }]);
    queryClient.setQueryData(["album", "same-id"], { name: "Album A" });
    await useSession.getState().logout();
    vi.spyOn(SubsonicClient.prototype, "ping").mockResolvedValue({});
    await useSession.getState().login(server, user, "test-password");
    expect(queryClient.getQueryData(["album", "same-id"])).toBeUndefined();
    const fetchB = vi.fn().mockResolvedValue([{ id: "private-B" }]);
    expect(await queryClient.fetchQuery({ queryKey: ["playlists"], queryFn: fetchB })).toEqual([{ id: "private-B" }]);
    expect(fetchB).toHaveBeenCalledOnce();
  });

  it("verwirft auch verspätete Antworten der alten Sitzung", async () => {
    useSession.setState({ creds: credentials, client: new SubsonicClient(credentials) });
    const oldResponse = deferred();
    const oldRequest = queryClient.fetchQuery({ queryKey: ["playlists"], queryFn: () => oldResponse.promise }).catch(() => undefined);
    await useSession.getState().logout();
    useSession.setState({ creds: { ...credentials, username: "B" }, client: new SubsonicClient({ ...credentials, username: "B" }) });
    queryClient.setQueryData(["playlists"], [{ id: "private-B" }]);
    oldResponse.resolve([{ id: "private-A" }]);
    await oldRequest;
    expect(queryClient.getQueryData(["playlists"])).toEqual([{ id: "private-B" }]);
  });

  it("stoppt Audio, leert Quelle, Queue und Media Session beim Abmelden", async () => {
    useSession.setState({ creds: credentials, client: new SubsonicClient(credentials) });
    usePlayer.getState().setVolume(0.4);
    usePlayer.getState().playQueue([{ id: "song-A", title: "A", duration: 90 }]);
    const audio = Audio.instances[0];
    expect(audio.paused).toBe(false);
    expect(navigator.mediaSession.metadata.title).toBe("A");
    await useSession.getState().logout();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe("");
    expect(usePlayer.getState()).toMatchObject({ queue: [], index: -1, playing: false, position: 0, duration: 0, volume: 0.4 });
    expect(navigator.mediaSession.metadata).toBeNull();
    expect(navigator.mediaSession.playbackState).toBe("none");
  });
});

describe("Sitzung wiederherstellen (#6)", () => {
  it("erlaubt den Login trotz beschädigtem JSON", async () => {
    localStorage.setItem("credentials", "{broken");
    await expect(useSession.getState().restore()).resolves.toBeUndefined();
    expect(useSession.getState()).toMatchObject({ ready: true, creds: null, client: null });
  });

  it.each([{}, { ...credentials, token: 123 }, { ...credentials, username: " " }, { ...credentials, serverUrl: "javascript:alert(1)" }])("verwirft strukturell ungültige Zugangsdaten: %j", async (value) => {
    localStorage.setItem("credentials", JSON.stringify(value));
    await useSession.getState().restore();
    expect(useSession.getState()).toMatchObject({ ready: true, creds: null, client: null });
    expect(localStorage.getItem("credentials")).toBeNull();
  });

  it("erlaubt den Login nach einem Fehler des nativen Stores", async () => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(load).mockRejectedValueOnce(new Error("Store unlesbar"));
    await expect(useSession.getState().restore()).resolves.toBeUndefined();
    expect(useSession.getState()).toMatchObject({ ready: true, creds: null, client: null });
  });

  it("stellt eine gültige Sitzung weiterhin wieder her", async () => {
    localStorage.setItem("credentials", JSON.stringify(credentials));
    await useSession.getState().restore();
    expect(useSession.getState()).toMatchObject({ ready: true, creds: credentials });
    expect(useSession.getState().client).toBeInstanceOf(SubsonicClient);
  });
});
