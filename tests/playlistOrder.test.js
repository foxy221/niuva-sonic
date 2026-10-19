import { describe, expect, it } from "vitest";
import { applyOrder, moveId } from "../src/state/playlistOrder";

const list = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("applyOrder", () => {
  it("sortiert nach gespeicherter Reihenfolge und hängt Neue hinten an", () => {
    expect(applyOrder(list, ["c", "a"]).map((p) => p.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("ignoriert gelöschte Playlists", () => {
    expect(applyOrder(list, ["x", "d", "b"]).map((p) => p.id)).toEqual(["d", "b", "a", "c"]);
  });
});

describe("moveId", () => {
  it("verschiebt nach vorn und hinten", () => {
    expect(moveId(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveId(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
});
