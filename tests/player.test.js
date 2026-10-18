import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubsonicClient } from "../src/api/subsonic";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";
import { defaultSettings, useSettings } from "../src/state/settings";

const credentials = { serverUrl: "https://music-a.example", username: "A", token: "a".repeat(32), salt: "salt" };
const song = (id, duration = 100) => ({ id, title: id.toUpperCase(), duration });

/** Das erste Element ist das spielende; die Attrappe liegt in `tests/setup.js`. */
const audio = () => Audio.instances[0];

/** Hörzeit simulieren: Position setzen und ein Fortschrittsereignis auslösen. */
function listenTo(seconds) {
  const el = audio();
  el.currentTime = seconds;
  el.dispatchEvent(new Event("timeupdate"));
}

const scrobbleCalls = () => vi.mocked(SubsonicClient.prototype.scrobble).mock.calls.map(([input]) => input);

beforeEach(() => {
  localStorage.clear();
  useSettings.setState({ settings: { ...defaultSettings } });
  usePlayer.getState().reset();
  usePlayer.setState({ repeat: "off", shuffle: false, unshuffled: null });
  useSession.setState({ ready: true, creds: credentials, client: new SubsonicClient(credentials) });
  vi.spyOn(SubsonicClient.prototype, "scrobble").mockResolvedValue({});
});

describe("Warteschlange (#7)", () => {
  it("mischt, ohne den laufenden Titel zu verlieren, und stellt die Reihenfolge wieder her", () => {
    const songs = [song("a"), song("b"), song("c"), song("d")];
    usePlayer.getState().playQueue(songs, 2);

    usePlayer.getState().toggleShuffle();
    const shuffled = usePlayer.getState().queue;
    expect(shuffled).toHaveLength(4);
    expect(shuffled[0].id).toBe("c");
    expect([...shuffled].map((s) => s.id).sort()).toEqual(["a", "b", "c", "d"]);

    usePlayer.getState().toggleShuffle();
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(usePlayer.getState().queue[usePlayer.getState().index].id).toBe("c");
  });

  it("spielt als Nächstes und hängt an", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);

    usePlayer.getState().playNext([song("x")]);
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["a", "x", "b"]);

    usePlayer.getState().appendToQueue([song("y")]);
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["a", "x", "b", "y"]);
    expect(usePlayer.getState().index).toBe(0);
  });

  it("startet mit dem angehängten Titel, wenn noch nichts läuft", () => {
    usePlayer.getState().appendToQueue([song("a")]);
    expect(usePlayer.getState().index).toBe(0);
    expect(usePlayer.getState().playing).toBe(true);
  });

  it("entfernt und sortiert um, ohne den laufenden Titel zu verlieren", () => {
    usePlayer.getState().playQueue([song("a"), song("b"), song("c")], 1);

    usePlayer.getState().removeFromQueue(0);
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["b", "c"]);
    expect(usePlayer.getState().queue[usePlayer.getState().index].id).toBe("b");

    usePlayer.getState().moveInQueue(1, 0);
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["c", "b"]);
    expect(usePlayer.getState().queue[usePlayer.getState().index].id).toBe("b");
  });

  it("spielt nach dem Entfernen des laufenden Titels den nächsten", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    usePlayer.getState().removeFromQueue(0);
    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["b"]);
    expect(usePlayer.getState().index).toBe(0);
    expect(audio().src).toContain("id=b");
  });

  it("leert die Warteschlange und hält die Wiedergabe an", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    usePlayer.getState().clearQueue();
    expect(usePlayer.getState()).toMatchObject({ queue: [], index: -1, playing: false, position: 0 });
    expect(audio().paused).toBe(true);
    expect(audio().src).toBe("");
  });
});
describe("Wiederholen (#8)", () => {
  it("wiederholt den Titel nur beim natürlichen Ende", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    usePlayer.getState().cycleRepeat();
    usePlayer.getState().cycleRepeat();
    expect(usePlayer.getState().repeat).toBe("track");

    audio().dispatchEvent(new Event("ended"));
    expect(usePlayer.getState().index).toBe(0);
    expect(usePlayer.getState().playing).toBe(true);
  });

  it("springt am Ende zurück, wenn die Warteschlange wiederholt wird", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 1);
    usePlayer.getState().cycleRepeat();
    expect(usePlayer.getState().repeat).toBe("queue");

    audio().dispatchEvent(new Event("ended"));
    expect(usePlayer.getState().index).toBe(0);
  });

  it("hält am Ende an, wenn nichts wiederholt wird", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    audio().dispatchEvent(new Event("ended"));
    expect(usePlayer.getState().playing).toBe(false);
    expect(usePlayer.getState().position).toBe(0);
  });
});

describe("Scrobbling (#9)", () => {
  it("meldet den Start und zählt nach genug Hörzeit genau einmal", () => {
    usePlayer.getState().playQueue([song("a", 100)], 0);
    expect(scrobbleCalls()).toEqual([{ id: "a", submission: false, time: undefined }]);

    for (let second = 1; second <= 60; second++) listenTo(second);

    const counted = scrobbleCalls().filter((input) => input.submission === true);
    expect(counted).toHaveLength(1);
    expect(counted[0].id).toBe("a");
  });

  it("zählt nicht, wenn nur gesprungen wird", () => {
    usePlayer.getState().playQueue([song("a", 600)], 0);
    listenTo(400);
    listenTo(401);
    expect(scrobbleCalls().some((input) => input.submission === true)).toBe(false);
  });

  it("meldet nichts, wenn das Zählen abgeschaltet ist", () => {
    useSettings.getState().update({ scrobble: false });
    usePlayer.getState().playQueue([song("a", 100)], 0);
    for (let second = 1; second <= 60; second++) listenTo(second);
    expect(scrobbleCalls()).toHaveLength(0);
  });
});

describe("Warteschlange über den Neustart (#10)", () => {
  it("schreibt beim Anhalten und stellt beim nächsten Start wieder her", async () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 1);
    audio().pause();

    await vi.waitFor(() => expect(localStorage.getItem("playerQueue")).toBeTruthy());
    const saved = JSON.parse(localStorage.getItem("playerQueue"));
    expect(saved.queue.map((s) => s.id)).toEqual(["a", "b"]);
    expect(saved.index).toBe(1);
    expect(saved.serverUrl).toBe(credentials.serverUrl);

    // Neustart: nur der Zustand im Speicher ist weg, die Ablage bleibt.
    usePlayer.setState({ queue: [], index: -1, playing: false, position: 0, duration: 0 });
    await usePlayer.getState().restore();

    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["a", "b"]);
    expect(usePlayer.getState().index).toBe(1);
    expect(usePlayer.getState().playing).toBe(false);
  });

  it("übernimmt keine Warteschlange eines anderen Servers", async () => {
    usePlayer.getState().playQueue([song("a")], 0);
    audio().pause();
    await vi.waitFor(() => expect(localStorage.getItem("playerQueue")).toBeTruthy());

    const other = { ...credentials, serverUrl: "https://music-b.example", username: "B" };
    useSession.setState({ creds: other, client: new SubsonicClient(other) });
    usePlayer.setState({ queue: [], index: -1 });
    await usePlayer.getState().restore();
    expect(usePlayer.getState().queue).toHaveLength(0);
  });
describe("Lückenlose Wiedergabe (#11)", () => {
  it("übernimmt den vorgeladenen Titel, statt ihn neu zu laden", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    const standby = Audio.instances[1];
    expect(standby.src).toContain("id=b");

    // Bereitliegend markieren, dann läuft der Titel natürlich aus.
    standby.readyState = 3;
    audio().dispatchEvent(new Event("ended"));

    expect(usePlayer.getState().index).toBe(1);
    expect(standby.paused).toBe(false);
    expect(standby.src).toContain("id=b");
    expect(audio().src).toBe("");
  });

  it("lädt neu, wenn das Vorladen abgeschaltet ist", () => {
    useSettings.getState().update({ gapless: false });
    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    expect(Audio.instances[1].src).toBe("");

    audio().dispatchEvent(new Event("ended"));
    expect(usePlayer.getState().index).toBe(1);
    expect(audio().src).toContain("id=b");
  });
});

});
