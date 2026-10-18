import { describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../src/state/audioEngine";
import { deferred } from "./setup";

function createEngine() {
  const handlers = Object.fromEntries(["onPlay", "onPause", "onTime", "onDuration", "onEnded", "onError", "onWaiting", "onReady"].map((key) => [key, vi.fn()]));
  return { engine: new AudioEngine(handlers), handlers };
}

describe("Audio-Engine: Quellenwechsel und Seek", () => {
  it("ignoriert ein spätes play-Reject des zuvor geladenen Titels", async () => {
    const { engine, handlers } = createEngine();
    const pending = deferred();
    vi.spyOn(engine.element, "play").mockImplementationOnce(() => pending.promise);
    engine.load("https://music.example/a");
    engine.load("https://music.example/b");
    pending.reject(new DOMException("Quelle ersetzt", "AbortError"));
    await Promise.resolve();
    expect(engine.paused).toBe(false);
    expect(handlers.onPause).not.toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it("meldet einen blockierten Start als bedienbaren Fehler", async () => {
    const { engine, handlers } = createEngine();
    vi.spyOn(engine.element, "play").mockRejectedValueOnce(new DOMException("Autoplay blockiert", "NotAllowedError"));
    engine.load("https://music.example/a");
    await Promise.resolve();
    expect(handlers.onPause).toHaveBeenCalledOnce();
    expect(handlers.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 0 }));
  });

  it("lädt eine pausierte Quelle ohne die vorherige Wiedergabe weiterlaufen zu lassen", () => {
    const { engine, handlers } = createEngine();
    engine.load("https://music.example/a");
    engine.load("https://music.example/b", { autoplay: false, position: 20 });
    expect(engine.paused).toBe(true);
    // Interne Pause darf keine alte Queue mit der neuen Sitzung speichern.
    expect(handlers.onPause).not.toHaveBeenCalled();
  });

  it("überschreibt einen neuen Seek nicht mit der zuvor gespeicherten Position", () => {
    const { engine } = createEngine();
    engine.load("https://music.example/a", { autoplay: false, position: 20 });
    engine.seek(5);
    engine.element.dispatchEvent(new Event("loadedmetadata"));
    expect(engine.position).toBe(5);
  });

  it("begrenzt eine gespeicherte Position auf die tatsächliche Titellänge", () => {
    const { engine } = createEngine();
    engine.load("https://music.example/a", { autoplay: false, position: 200 });
    engine.element.duration = 50;
    engine.element.dispatchEvent(new Event("loadedmetadata"));
    expect(engine.position).toBe(50);
  });
});
