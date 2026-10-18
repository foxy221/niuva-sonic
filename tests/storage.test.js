import { afterEach, describe, expect, it, vi } from "vitest";
import { load } from "@tauri-apps/plugin-store";
import { writeValue, removeValue, readValue } from "../src/state/storage";
import { deferred } from "./setup";

vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }));
afterEach(() => { delete window.__TAURI_INTERNALS__; });

describe("Native Persistenz", () => {
  it("lässt ein langsames Save nicht eine geleerte Queue zurückbringen", async () => {
    window.__TAURI_INTERNALS__ = {};
    const pending = deferred();
    let stored = null;
    vi.mocked(load).mockResolvedValue({
      set: async (_key, value) => { await pending.promise; stored = value; },
      delete: async () => { stored = null; },
      save: async () => {},
      get: async () => stored,
    });
    const writing = writeValue("player.json", "queue", { id: "old" });
    const removing = removeValue("player.json", "queue");
    pending.resolve();
    await Promise.all([writing, removing]);
    expect(await readValue("player.json", "queue")).toBeNull();
  });

  it("führt spätere Änderungen auch nach einem fehlgeschlagenen Save aus", async () => {
    window.__TAURI_INTERNALS__ = {};
    const remove = vi.fn();
    vi.mocked(load).mockResolvedValue({ set: async () => { throw Error("Speicher voll"); }, delete: remove, save: async () => {} });
    const writing = writeValue("player.json", "queue", {}).catch(() => {});
    const removing = removeValue("player.json", "queue");
    await Promise.all([writing, removing]);
    expect(remove).toHaveBeenCalledWith("queue");
  });
});
