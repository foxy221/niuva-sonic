import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubsonicClient } from "../src/api/subsonic";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";
import { defaultSettings, useSettings } from "../src/state/settings";

/**
 * Nachträge zur Abdeckung des Player-Stores: Lautstärke und ReplayGain,
 * Grenzen der Warteschlangen-Befehle, Fehlerbehandlung und das sofortige
 * Speichern beim Beenden. Die Regressionsfälle aus Phase 2 stehen in
 * `player.review.test.js`.
 */

const credentials = { serverUrl: "https://music-a.example", username: "A", token: "a".repeat(32), salt: "salt" };
const song = (id, extra = {}) => ({ id, title: id.toUpperCase(), duration: 100, ...extra });

/** Das erste Element ist das spielende; die Attrappe liegt in `tests/setup.js`. */
const audio = () => Audio.instances[0];
const standby = () => Audio.instances[1];

beforeEach(() => {
  localStorage.clear();
  useSettings.setState({ settings: { ...defaultSettings } });
  usePlayer.getState().reset();
  usePlayer.setState({ repeat: "off", shuffle: false, unshuffled: null, volume: 0.8, error: null });
  useSession.setState({ ready: true, creds: credentials, client: new SubsonicClient(credentials) });
  vi.spyOn(SubsonicClient.prototype, "scrobble").mockResolvedValue({});
});

describe("Lautstärke und ReplayGain", () => {
  it("begrenzt die Lautstärke auf 0 bis 1 und merkt sie", () => {
    usePlayer.getState().setVolume(2);
    expect(usePlayer.getState().volume).toBe(1);
    expect(localStorage.getItem("volume")).toBe("1");

    usePlayer.getState().setVolume(-1);
    expect(usePlayer.getState().volume).toBe(0);
    expect(audio().volume).toBe(0);
  });

  it("rechnet ReplayGain auf die Elementlautstärke an", () => {
    useSettings.setState({ settings: { ...defaultSettings, replayGain: "track" } });
    usePlayer.getState().playQueue([song("a", { replayGain: { trackGain: -6 } })], 0);

    expect(audio().volume).toBeCloseTo(0.8 * 10 ** (-6 / 20), 3);

    usePlayer.getState().setVolume(0.5);
    expect(audio().volume).toBeCloseTo(0.5 * 10 ** (-6 / 20), 3);
    expect(standby().volume).toBe(audio().volume);
  });

  it("lässt die Lautstärke ohne ReplayGain-Werte unverändert", () => {
    useSettings.setState({ settings: { ...defaultSettings, replayGain: "album" } });
    usePlayer.getState().playQueue([song("a")], 0);
    usePlayer.getState().setVolume(0.6);
    expect(audio().volume).toBeCloseTo(0.6, 5);
  });
});

describe("Grenzen der Warteschlangen-Befehle", () => {
  it("springt nur auf vorhandene Plätze", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);

    usePlayer.getState().jumpTo(5);
    expect(usePlayer.getState().index).toBe(0);
    usePlayer.getState().jumpTo(-1);
    expect(usePlayer.getState().index).toBe(0);

    usePlayer.getState().jumpTo(1);
    expect(usePlayer.getState().index).toBe(1);
    expect(audio().src).toContain("id=b");
  });

  it("nimmt eine unmögliche Umsortierung nicht an", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 1);

    usePlayer.getState().moveInQueue(0, 9);
    usePlayer.getState().moveInQueue(-1, 0);
    usePlayer.getState().moveInQueue(1, 1);

    expect(usePlayer.getState().queue.map((s) => s.id)).toEqual(["a", "b"]);
    expect(usePlayer.getState().index).toBe(1);
  });

  it("begrenzt einen Startplatz außerhalb der Liste", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 7);
    expect(usePlayer.getState().index).toBe(1);

    usePlayer.getState().playQueue([], 0);
    expect(usePlayer.getState().queue).toHaveLength(2);
  });
});

describe("Fehler und Wiederholen", () => {
  it("zeigt einen Ladefehler an und protokolliert ihn", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    usePlayer.getState().playQueue([song("a")], 0);

    audio().dispatchEvent(new Event("error"));

    expect(usePlayer.getState().error).toBe("Format nicht unterstützt oder Datei fehlt.");
    expect(usePlayer.getState().playing).toBe(false);
    expect(logged.mock.calls.some(([line]) => String(line).includes("Playback failed"))).toBe(true);
  });

  it("lädt beim Wiederholen denselben Titel an derselben Stelle", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    audio().dispatchEvent(new Event("error"));
    usePlayer.setState({ position: 42 });
    usePlayer.getState().dismissError();
    expect(usePlayer.getState().error).toBeNull();

    audio().dispatchEvent(new Event("error"));
    usePlayer.getState().retry();

    expect(usePlayer.getState().error).toBeNull();
    expect(usePlayer.getState().index).toBe(0);
    expect(usePlayer.getState().position).toBe(42);
    expect(audio().src).toContain("id=a");
  });

  it("startet nach einem Fehler erst auf Wunsch wieder", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    audio().pause();
    audio().dispatchEvent(new Event("error"));
    expect(usePlayer.getState().playing).toBe(false);

    usePlayer.getState().toggle();
    expect(usePlayer.getState().error).toBeNull();
    expect(usePlayer.getState().playing).toBe(true);
  });
});

describe("Sofortiges Speichern", () => {
  it("schreibt beim Flush die aktuelle Position", async () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 1);
    usePlayer.setState({ position: 17 });

    await usePlayer.getState().flush();

    const saved = JSON.parse(localStorage.getItem("playerQueue"));
    expect(saved.index).toBe(1);
    expect(saved.position).toBe(17);
    expect(saved.queue.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("löscht die gemerkte Warteschlange beim Leeren", async () => {
    usePlayer.getState().playQueue([song("a")], 0);
    await usePlayer.getState().flush();
    expect(localStorage.getItem("playerQueue")).toBeTruthy();

    usePlayer.getState().clearQueue();
    await vi.waitFor(() => expect(localStorage.getItem("playerQueue")).toBeNull());
  });
});

describe("Radiosender", () => {
  const station = { id: "radio:7", title: "Soma FM", artist: "Live", radioUrl: "https://ice.example/stream" };

  it("spielt die Adresse des Senders, ohne zu scrobbeln oder zu springen", () => {
    usePlayer.getState().playQueue([station], 0);
    expect(audio().src).toBe("https://ice.example/stream");
    expect(SubsonicClient.prototype.scrobble).not.toHaveBeenCalled();
    usePlayer.getState().seek(30);
    expect(usePlayer.getState().position).toBe(0);
  });

  it("lädt einen folgenden Sender nicht vor", () => {
    usePlayer.getState().playQueue([song("a"), station], 0);
    expect(standby().src).not.toBe("https://ice.example/stream");
  });
});
