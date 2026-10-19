import { describe, expect, it } from "vitest";
import { IcyParser, streamTitle } from "../src/icy";

const enc = (text) => new TextEncoder().encode(text);
function block(text) {
  const bytes = enc(text);
  const out = new Uint8Array(1 + Math.ceil(bytes.length / 16) * 16);
  out[0] = Math.ceil(bytes.length / 16);
  out.set(bytes, 1);
  return out;
}
const join = (...parts) => Uint8Array.from(parts.flatMap((p) => [...p]));

describe("ICY-Metadaten", () => {
  it("findet den Block nach metaint Audiobytes, auch über Stückgrenzen hinweg", () => {
    const seen = [];
    const parser = new IcyParser(8, (b) => seen.push(streamTitle(b)));
    const data = join(new Uint8Array(8), block("StreamTitle='Daft Punk - Around The World';"), new Uint8Array(8), Uint8Array.of(0));
    for (let i = 0; i < data.length; i += 5) parser.push(data.slice(i, i + 5));
    expect(seen).toEqual(["Daft Punk - Around The World"]);
  });

  it("liest Umlaute und lässt leere Titel weg", () => {
    expect(streamTitle("StreamTitle='Björk - Jóga';StreamUrl='';")).toBe("Björk - Jóga");
    expect(streamTitle("StreamTitle='';")).toBeNull();
    expect(streamTitle("StreamTitle='It's Alright - X';")).toBe("It's Alright - X");
  });
});
