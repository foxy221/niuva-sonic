import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubsonicClient } from "../src/api/subsonic";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";
import { defaultSettings, useSettings } from "../src/state/settings";
import * as storage from "../src/state/storage";
import { deferred } from "./setup";

const credentials = { serverUrl: "https://music.example", username: "A", token: "a".repeat(32), salt: "salt" };
const song = (id) => ({ id, title: id, duration: 100 });
const player = () => usePlayer.getState();
const audio = () => Audio.instances.find((el) => !el.paused && el.src) ?? Audio.instances.find((el) => el.src);
const tick = (position) => {
  const el = audio();
  el.currentTime = position;
  el.dispatchEvent(new Event("timeupdate"));
};
const saved = (extra = {}) => ({ serverUrl: credentials.serverUrl, username: credentials.username, queue: [song("saved")], index: 0, position: 20, shuffle: false, repeat: "off", ...extra });
const counted = () => vi.mocked(SubsonicClient.prototype.scrobble).mock.calls.map(([input]) => input).filter((input) => input.submission);
const mediaHandlers = new Map(navigator.mediaSession.setActionHandler.mock.calls);

beforeEach(async () => {
  useSession.setState({ creds: null, client: null });
  await player().restore();
  localStorage.clear();
  useSettings.setState({ settings: { ...defaultSettings } });
  useSession.setState({ creds: credentials, client: new SubsonicClient(credentials) });
  await player().restore();
  usePlayer.setState({ shuffle: false, repeat: "off" });
  vi.spyOn(SubsonicClient.prototype, "scrobble").mockResolvedValue({});
});

afterEach(() => { player().reset(); vi.useRealTimers(); });

describe("Phase-2-Review: Persistenz und Sitzungsgrenzen", () => {
  it("behält die Queue beim echten Sitzungsstart, ohne Autoplay oder Scrobble", async () => {
    useSession.setState({ creds: null, client: null });
    await player().restore();
    localStorage.setItem("credentials", JSON.stringify(credentials));
    localStorage.setItem("playerQueue", JSON.stringify(saved()));
    await Promise.all([useSession.getState().restore(), useSession.getState().restore()]);
    await player().restore();
    expect(player().queue.map((s) => s.id)).toEqual(["saved"]);
    expect(player().position).toBe(20);
    expect(player().playing).toBe(false);
    expect(Audio.instances.every((el) => el.paused)).toBe(true);
    expect(SubsonicClient.prototype.scrobble).not.toHaveBeenCalled();
  });

  it("übernimmt keine Queue eines anderen Benutzers auf demselben Server", async () => {
    localStorage.setItem("playerQueue", JSON.stringify(saved({ username: "B" })));
    await player().restore();
    expect(player().queue).toEqual([]);
  });

  it.each(["logout", "new-playback"])("verwirft eine verspätete Queue-Antwort nach %s", async (action) => {
    const pending = deferred();
    const actualRead = storage.readValue;
    vi.spyOn(storage, "readValue").mockImplementation((file, key) => key === "playerQueue" ? pending.promise : actualRead(file, key));
    const restoring = player().restore();
    await Promise.resolve();
    await Promise.resolve();
    if (action === "logout") await useSession.getState().logout();
    else player().playQueue([song("new")]);
    pending.resolve(saved());
    await restoring;
    expect(player().queue.map((s) => s.id)).toEqual(action === "logout" ? [] : ["new"]);
  });

  it("stellt auch die ursprüngliche Reihenfolge nach einem Shuffle-Neustart wieder her", async () => {
    player().playQueue([song("a"), song("b"), song("c")], 1);
    player().toggleShuffle();
    audio().pause();
    await player().restore();
    player().toggleShuffle();
    expect(player().queue.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(player().queue[player().index].id).toBe("b");
  });

  it("löscht beim Abschalten von rememberQueue auch die alte gespeicherte Queue", () => {
    player().playQueue([song("a")]);
    audio().pause();
    expect(localStorage.getItem("playerQueue")).not.toBeNull();
    useSettings.getState().update({ rememberQueue: false });
    expect(localStorage.getItem("playerQueue")).toBeNull();
  });

  it("überschreibt eine neue Einstellung nicht mit einem verspäteten Restore", async () => {
    const pending = deferred();
    vi.spyOn(storage, "readValue").mockReturnValueOnce(pending.promise);
    const restoring = useSettings.getState().restore();
    useSettings.getState().update({ maxBitRate: 128 });
    pending.resolve({ ...defaultSettings, maxBitRate: 64 });
    await restoring;
    expect(useSettings.getState().settings.maxBitRate).toBe(128);
  });
});

describe("Phase-2-Review: Scrobbling und Queue", () => {
  it("startet beim Entfernen des pausierten Titels nicht ungefragt die Wiedergabe", () => {
    player().playQueue([song("a"), song("b")]);
    player().pause();
    player().removeFromQueue(0);
    expect(player().queue[player().index].id).toBe("b");
    expect(player().playing).toBe(false);
    expect(Audio.instances.every((el) => el.paused)).toBe(true);
  });
  it("zählt eine manuell neu gestartete Wiedergabe nach dem Queue-Ende erneut", () => {
    player().playQueue([song("a")]);
    for (let i = 1; i <= 100; i++) tick(i);
    audio().dispatchEvent(new Event("ended"));
    player().play();
    for (let i = 1; i <= 100; i++) tick(i);
    expect(counted()).toHaveLength(2);
  });
  it("zählt jede vollständig gehörte Titelwiederholung", () => {
    player().playQueue([song("a")]);
    usePlayer.setState({ repeat: "track" });
    for (let i = 1; i <= 100; i++) tick(i);
    audio().dispatchEvent(new Event("ended"));
    for (let i = 1; i <= 100; i++) tick(i);
    expect(counted()).toHaveLength(2);
  });

  it("behält Hörzeit und Zählstatus bei Qualitätswechseln", () => {
    player().playQueue([song("a")]);
    for (let i = 1; i <= 40; i++) tick(i);
    useSettings.getState().update({ maxBitRate: 128 });
    audio().dispatchEvent(new Event("loadedmetadata"));
    for (let i = 41; i <= 60; i++) tick(i);
    expect(counted()).toHaveLength(1);
    useSettings.getState().update({ format: "mp3" });
    audio().dispatchEvent(new Event("loadedmetadata"));
    for (let i = 61; i <= 100; i++) tick(i);
    expect(counted()).toHaveLength(1);
  });

  it("zählt Fortschrittsereignisse während einer Pause nicht als Hörzeit", () => {
    player().playQueue([song("a")]);
    audio().pause();
    for (let i = 1; i <= 60; i++) tick(i);
    expect(counted()).toHaveLength(0);
  });

  it("entfernt unter Shuffle nur ein Vorkommen desselben Song-Objekts", () => {
    const duplicate = song("a");
    player().playQueue([duplicate, duplicate, song("b")]);
    player().toggleShuffle();
    player().removeFromQueue(0);
    player().toggleShuffle();
    expect(player().queue.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("wendet die Vorladen-Einstellung sofort an", () => {
    player().playQueue([song("a"), song("b")]);
    expect(Audio.instances[1].src).toContain("id=b");
    useSettings.getState().update({ gapless: false });
    expect(Audio.instances[1].src).toBe("");
    useSettings.getState().update({ gapless: true });
    expect(Audio.instances[1].src).toContain("id=b");
  });

  it("übernimmt die bereits geladene Dauer des vorgeladenen Titels", () => {
    player().playQueue([song("a"), { id: "b", title: "b" }]);
    const standby = Audio.instances[1];
    standby.readyState = 3;
    standby.duration = 123;
    audio().dispatchEvent(new Event("ended"));
    expect(player().duration).toBe(123);
  });
});

describe("Phase-2-Review: Fehler und Systemaktionen", () => {
  it("meldet eine pausierte Queue beim Netzwechsel nicht als puffernd und startet sie nicht", () => {
    player().playQueue([song("a")]);
    player().pause();
    window.dispatchEvent(new Event("offline"));
    expect(player().buffering).toBe(false);
    window.dispatchEvent(new Event("online"));
    expect(player().playing).toBe(false);
  });
  it("begrenzt aufeinanderfolgende Fehlersprünge auch nach canplay", () => {
    vi.useFakeTimers();
    player().playQueue([song("a"), song("b")]);
    for (let i = 0; i < 4; i++) {
      const el = audio();
      el.dispatchEvent(new Event("canplay"));
      el.error = { code: 3 };
      el.dispatchEvent(new Event("error"));
      vi.advanceTimersByTime(600);
    }
    expect(vi.mocked(SubsonicClient.prototype.scrobble).mock.calls.length).toBeLessThanOrEqual(4);
    expect(player().playing).toBe(false);
    expect(player().error).not.toBeNull();
  });

  it("setzt einen Fehlersprung nicht nach manueller Pause fort", () => {
    vi.useFakeTimers();
    player().playQueue([song("a"), song("b")]);
    audio().error = { code: 3 };
    audio().dispatchEvent(new Event("error"));
    // Explizite Pause über die Systemsteuerung.
    mediaHandlers.get("pause")();
    vi.advanceTimersByTime(600);
    expect(player().index).toBe(0);
    expect(player().playing).toBe(false);
  });

  it("behandelt Media-Session play und pause idempotent", () => {
    player().playQueue([song("a")]);
    const handlers = mediaHandlers;
    handlers.get("play")();
    expect(player().playing).toBe(true);
    handlers.get("pause")();
    handlers.get("pause")();
    expect(player().playing).toBe(false);
  });
});
