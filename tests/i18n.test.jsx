import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Pager from "../src/components/Pager";
import { de } from "../src/i18n/de";
import { en } from "../src/i18n/en";
import { DEFAULT_LANGUAGE, translate, useLanguage, t } from "../src/i18n";
import { formatBytes } from "../src/format";

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("Sprachdateien", () => {
  it("haben dieselben Schlüssel", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("lassen keinen Text leer und halten die Platzhalter gleich", () => {
    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en)) {
      expect(en[key].trim(), key).not.toBe("");
      expect(de[key].trim(), key).not.toBe("");
      expect(placeholders(de[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("enthalten jeden Schlüssel, den der Quelltext benutzt", () => {
    const used = new Set();
    for (const file of sources("src")) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\b(?:t|tr)\(\s*(?:\w+ \? )?"([a-zA-Z][\w.]*)"(?: : "([a-zA-Z][\w.]*)")?/g)) {
        used.add(match[1]);
        if (match[2]) used.add(match[2]);
      }
      for (const match of text.matchAll(/(?:label|title): "((?:nav|albums|settings|home)\.[\w.]+)"/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(100);
    for (const key of used) {
      const known = key in en || `${key}_other` in en;
      expect(known, `fehlt in en.ts: ${key}`).toBe(true);
    }
  });
});

describe("Übersetzen", () => {
  it("setzt Parameter ein und wählt die Mehrzahlform", () => {
    expect(translate("en", "count.tracks", { count: 1 })).toBe("1 track");
    expect(translate("en", "count.tracks", { count: 3 })).toBe("3 tracks");
    expect(translate("de", "count.albums", { count: 1 })).toBe("1 Album");
    expect(translate("de", "count.albums", { count: 0 })).toBe("0 Alben");
    expect(translate("en", "pager.page", { page: 4 })).toBe("Page 4");
  });

  it("lässt unbekannte Platzhalter stehen", () => {
    expect(translate("en", "pager.page", {})).toBe("Page {page}");
  });
});

describe("Spracheinstellung", () => {
  beforeEach(() => {
    localStorage.clear();
    useLanguage.setState({ language: DEFAULT_LANGUAGE, ready: false });
  });

  it("startet frisch mit Englisch und merkt es", async () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    await useLanguage.getState().restore();
    expect(useLanguage.getState()).toMatchObject({ language: "en", ready: true });
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("language"))).toBe("en"));
  });

  it("bleibt bei einer bestehenden Installation deutsch", async () => {
    localStorage.setItem("playbackSettings", JSON.stringify({ gapless: true }));
    await useLanguage.getState().restore();
    expect(useLanguage.getState().language).toBe("de");
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("language"))).toBe("de"));
  });

  it("nimmt die gewählte Sprache vor allem anderen", async () => {
    localStorage.setItem("playbackSettings", JSON.stringify({ gapless: true }));
    localStorage.setItem("language", JSON.stringify("en"));
    await useLanguage.getState().restore();
    expect(useLanguage.getState().language).toBe("en");
  });

  it("ignoriert eine unbrauchbare gemerkte Sprache", async () => {
    localStorage.setItem("language", JSON.stringify("fr"));
    await useLanguage.getState().restore();
    expect(useLanguage.getState().language).toBe("en");
  });

  it("wechselt die sichtbaren Texte sofort und merkt die Wahl", async () => {
    useLanguage.setState({ language: "de", ready: true });
    render(<Pager page={1} hasNext onPage={() => {}} />);
    expect(screen.getByText("Seite 2")).toBeTruthy();
    act(() => useLanguage.getState().setLanguage("en"));
    expect(screen.getByText("Page 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next/ })).toBeTruthy();
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("language"))).toBe("en"));
    expect(t("nav.settings")).toBe("Settings");
  });

  it("schreibt Größen mit dem Dezimalzeichen der Sprache", () => {
    useLanguage.setState({ language: "de", ready: true });
    expect(formatBytes(1_500_000_000)).toBe("1,5 GB");
    useLanguage.setState({ language: "en" });
    expect(formatBytes(1_500_000_000)).toBe("1.5 GB");
  });
});
