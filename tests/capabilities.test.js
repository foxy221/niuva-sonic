import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { SubsonicClient } from "../src/api/subsonic";
import { replayGainSupported, useCapabilities } from "../src/state/capabilities";
import { logError, logWrite, useLog } from "../src/state/log";
import { useSession } from "../src/state/session";
import { deferred } from "./setup";

/**
 * Was der Server kann, und das Protokoll.
 *
 * `ping` und `getOpenSubsonicExtensions` sind nachgestellt; geprüft wird, wie
 * die Fähigkeiten abgelegt werden, wie sich Fehler verhalten und dass eine
 * verspätete Antwort einer alten Sitzung nichts überschreibt.
 */

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const creds = { serverUrl: "https://musik.example", username: "A", token: "t".repeat(32), salt: "salz" };
const client = () => new SubsonicClient(creds);

beforeEach(() => {
  useCapabilities.getState().reset();
  useLog.setState({ ready: false, path: null, lines: [], error: null });
  useSession.setState({ ready: true, creds, client: client() });
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "log_message") return null;
    if (command === "read_log") return { path: "C:/logs/niuva-sonic.log", lines: ["2026-10-18 10:00:00 INFO  Start"] };
    if (command === "clear_log") return null;
    throw new Error(`Unerwarteter Befehl: ${command}`);
  });
  vi.spyOn(SubsonicClient.prototype, "ping").mockResolvedValue({ type: "navidrome", serverVersion: "0.64.2", openSubsonic: true });
  vi.spyOn(SubsonicClient.prototype, "getOpenSubsonicExtensions").mockResolvedValue([
    { name: "songLyrics", versions: [1, 2] },
    { name: "indexBasedQueue", versions: [1] },
  ]);
});

describe("Fähigkeiten des Servers", () => {
  it("merkt Kennung und Erweiterungen eines OpenSubsonic-Servers", async () => {
    await useCapabilities.getState().load();

    expect(useCapabilities.getState()).toMatchObject({
      ready: true,
      error: null,
      server: { type: "navidrome", serverVersion: "0.64.2", openSubsonic: true },
      extensions: { songLyrics: [1, 2], indexBasedQueue: [1] },
    });
    expect(useCapabilities.getState().supports("songLyrics")).toBe(true);
    expect(useCapabilities.getState().supports("songLyrics", 2)).toBe(true);
    expect(useCapabilities.getState().supports("songLyrics", 3)).toBe(false);
    expect(useCapabilities.getState().supports("unbekannt")).toBe(false);
  });

  it("fragt Erweiterungen nur bei gemeldetem OpenSubsonic ab", async () => {
    vi.mocked(SubsonicClient.prototype.ping).mockResolvedValue({ type: "subsonic", serverVersion: "6.1.6" });

    await useCapabilities.getState().load();

    expect(SubsonicClient.prototype.getOpenSubsonicExtensions).not.toHaveBeenCalled();
    expect(useCapabilities.getState().extensions).toEqual({});
    expect(replayGainSupported(useCapabilities.getState().server)).toBe(false);
  });

  it("bleibt bei einer gescheiterten Erweiterungsabfrage bei der Serverkennung", async () => {
    vi.mocked(SubsonicClient.prototype.getOpenSubsonicExtensions).mockRejectedValue(new Error("nicht unterstützt"));

    await useCapabilities.getState().load();

    expect(useCapabilities.getState().server?.openSubsonic).toBe(true);
    expect(useCapabilities.getState().extensions).toEqual({});
    expect(useCapabilities.getState().error).toBeNull();
  });

  it("meldet einen unerreichbaren Server, ohne zu scheitern", async () => {
    vi.mocked(SubsonicClient.prototype.ping).mockRejectedValue(new Error("fetch failed"));

    await useCapabilities.getState().load();

    expect(useCapabilities.getState()).toMatchObject({ ready: true, server: null, extensions: {}, error: "fetch failed" });
    expect(replayGainSupported(useCapabilities.getState().server)).toBe(false);
  });

  it("verwirft die verspätete Antwort einer alten Sitzung", async () => {
    const slow = deferred();
    vi.mocked(SubsonicClient.prototype.ping).mockReturnValueOnce(slow.promise);

    const running = useCapabilities.getState().load();
    // Kontowechsel: der alte Lauf darf den neuen Stand nicht überschreiben.
    useCapabilities.getState().reset();
    await useCapabilities.getState().load();
    slow.resolve({ type: "alter-server", openSubsonic: true });
    await running;

    expect(useCapabilities.getState().server?.type).toBe("navidrome");
  });

  it("meldet ohne Sitzung nichts und räumt alte Werte weg", async () => {
    await useCapabilities.getState().load();
    useSession.setState({ creds: null, client: null });

    await useCapabilities.getState().load();

    expect(useCapabilities.getState()).toMatchObject({ ready: true, server: null, extensions: {}, error: null });
  });
});

describe("Protokoll", () => {
  it("liest Pfad und Zeilen aus der Hülle", async () => {
    window.__TAURI_INTERNALS__ = {};

    await useLog.getState().refresh();

    expect(useLog.getState().path).toBe("C:/logs/niuva-sonic.log");
    expect(useLog.getState().lines).toEqual(["2026-10-18 10:00:00 INFO  Start"]);
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("read_log", { maxLines: 200 });
    delete window.__TAURI_INTERNALS__;
  });

  it("leert die Datei und liest danach neu", async () => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "log_message") return null;
      if (command === "clear_log") return null;
      if (command === "read_log") return { path: "C:/logs/niuva-sonic.log", lines: [] };
      throw new Error(`Unerwarteter Befehl: ${command}`);
    });

    await useLog.getState().clear();

    expect(vi.mocked(invoke)).toHaveBeenCalledWith("clear_log");
    expect(useLog.getState().lines).toEqual([]);
    expect(useLog.getState().error).toBeNull();
    delete window.__TAURI_INTERNALS__;
  });

  it("meldet ein unlesbares Protokoll, statt zu scheitern", async () => {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockRejectedValue(new Error("kein Zugriff"));

    await useLog.getState().refresh();

    expect(useLog.getState().error).toContain("kein Zugriff");
    delete window.__TAURI_INTERNALS__;
  });

  it("bleibt ohne Tauri bei der Konsole", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    logWrite("info", "Start");
    logWrite("warn", "Achtung");
    logError(new Error("kaputt"), "Beim Laden");

    expect(info.mock.calls[0][0]).toContain("Start");
    expect(warn.mock.calls[0][0]).toContain("Achtung");
    expect(error.mock.calls[0][0]).toContain("Beim Laden: Error: kaputt");
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();

    await useLog.getState().refresh();
    expect(useLog.getState()).toMatchObject({ ready: true, path: null, lines: [] });
  });
});
