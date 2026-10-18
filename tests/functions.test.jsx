import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SubsonicClient } from "../src/api/subsonic";
import { SHORTCUTS, shortcutFor } from "../src/hooks/shortcuts";
import { useKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { en } from "../src/i18n/en";
import { activeLineIndex, pickLyrics } from "../src/lyrics";
import Settings from "../src/screens/Settings";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";

/** Punkt D: Songtexte, beliebteste Titel, Tastenkürzel, Server hinzufügen. */

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const creds = { serverUrl: "https://nav.example", username: "henrik", token: "t".repeat(32), salt: "salz12345678" };
const ok = (payload = {}) => ({ ok: true, status: 200, json: async () => ({ "subsonic-response": { status: "ok", ...payload } }) });
const key = (code, extra = {}) => ({ code, key: extra.key ?? code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...extra });
const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const song = (id) => ({ id, title: id, duration: 100 });

describe("Songtexte", () => {
  const synced = { synced: true, offset: 0, line: [{ start: 1000, value: "eins" }, { start: 5000, value: "zwei" }, { start: 9000, value: "drei" }] };
  const plain = { synced: false, line: [{ value: "nur Text" }] };

  it("bevorzugt synchrone Texte und überspringt leere", () => {
    expect(pickLyrics([plain, synced])).toBe(synced);
    expect(pickLyrics([plain])).toBe(plain);
    expect(pickLyrics([{ synced: true, line: [{ value: "  " }] }])).toBeNull();
    expect(pickLyrics([])).toBeNull();
  });

  it("findet die gesungene Zeile", () => {
    expect(activeLineIndex(synced, 0)).toBe(-1);
    expect(activeLineIndex(synced, 1)).toBe(0);
    expect(activeLineIndex(synced, 6.2)).toBe(1);
    expect(activeLineIndex(synced, 99)).toBe(2);
    expect(activeLineIndex(plain, 3)).toBe(-1);
  });

  it("berücksichtigt die Verschiebung des Servers", () => {
    expect(activeLineIndex({ ...synced, offset: 2000 }, 2)).toBe(-1);
    expect(activeLineIndex({ ...synced, offset: 2000 }, 3)).toBe(0);
  });

  it("fragt getLyricsBySongId ab und füllt fehlende Felder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ lyricsList: { structuredLyrics: [{ lang: "de", line: undefined }] } }));
    globalThis.fetch = fetchMock;
    const result = await new SubsonicClient(creds).getLyricsBySongId("s1");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname.endsWith("/getLyricsBySongId")).toBe(true);
    expect(url.searchParams.get("id")).toBe("s1");
    expect(result).toEqual([{ lang: "de", synced: false, line: [] }]);
  });
});

describe("Beliebteste Titel", () => {
  it("fragt getTopSongs mit Künstlername und liefert leer ohne Treffer", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ topSongs: { song: [{ id: "a", title: "A" }] } })).mockResolvedValueOnce(ok({}));
    globalThis.fetch = fetchMock;
    const client = new SubsonicClient(creds);
    expect(await client.getTopSongs("Pink Floyd", 5)).toHaveLength(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("artist")).toBe("Pink Floyd");
    expect(url.searchParams.get("count")).toBe("5");
    expect(await client.getTopSongs("Niemand")).toEqual([]);
  });
});

describe("Tastenkürzel", () => {
  it("ordnet Tasten Aktionen zu", () => {
    expect(shortcutFor(key("Space"), false)).toBe("toggle");
    expect(shortcutFor(key("Space"), true)).toBeNull();
    expect(shortcutFor(key("ArrowUp", { ctrlKey: true }), false)).toBe("volumeUp");
    expect(shortcutFor(key("ArrowDown", { ctrlKey: true }), false)).toBe("volumeDown");
    expect(shortcutFor(key("ArrowRight", { ctrlKey: true }), false)).toBe("next");
    expect(shortcutFor(key("ArrowLeft", { ctrlKey: true }), false)).toBe("prev");
    expect(shortcutFor(key("KeyK", { ctrlKey: true, key: "k" }), false)).toBe("search");
    expect(shortcutFor(key("ArrowLeft", { altKey: true }), false)).toBe("back");
    expect(shortcutFor(key("ArrowRight", { altKey: true }), false)).toBe("forward");
  });

  it("überlässt Textfeldern Pfeile, aber nicht die Suche", () => {
    expect(shortcutFor(key("ArrowLeft", { ctrlKey: true }), true)).toBeNull();
    expect(shortcutFor(key("KeyK", { ctrlKey: true, key: "K" }), true)).toBe("search");
  });

  it("ignoriert AltGr, Shift und Meta", () => {
    expect(shortcutFor(key("ArrowUp", { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(shortcutFor(key("ArrowUp", { ctrlKey: true, shiftKey: true }), false)).toBeNull();
    expect(shortcutFor(key("ArrowUp", { metaKey: true }), false)).toBeNull();
    expect(shortcutFor(key("KeyA"), false)).toBeNull();
  });

  it("jedes angezeigte Kürzel hat einen Text", () => {
    for (const shortcut of SHORTCUTS) expect(en).toHaveProperty(shortcut.label);
  });

  describe("im Fenster", () => {
    beforeEach(() => {
      localStorage.clear();
      useSession.setState({ ready: true, creds, client: new SubsonicClient(creds) });
      usePlayer.getState().reset();
      usePlayer.getState().playQueue([song("a"), song("b")], 0);
    });

    const press = (init, target) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      (target ?? window).dispatchEvent(event);
      return event;
    };

    it("regelt Lautstärke in Fünferschritten und begrenzt sie", () => {
      renderHook(() => useKeyboardShortcuts(), { wrapper });
      usePlayer.getState().setVolume(0.5);
      press({ code: "ArrowUp", key: "ArrowUp", ctrlKey: true });
      expect(usePlayer.getState().volume).toBeCloseTo(0.55);
      press({ code: "ArrowDown", key: "ArrowDown", ctrlKey: true });
      press({ code: "ArrowDown", key: "ArrowDown", ctrlKey: true });
      expect(usePlayer.getState().volume).toBeCloseTo(0.45);
      usePlayer.getState().setVolume(0.98);
      press({ code: "ArrowUp", key: "ArrowUp", ctrlKey: true });
      expect(usePlayer.getState().volume).toBe(1);
    });

    it("springt mit Strg+Pfeil zum nächsten Titel", () => {
      renderHook(() => useKeyboardShortcuts(), { wrapper });
      press({ code: "ArrowRight", key: "ArrowRight", ctrlKey: true });
      expect(usePlayer.getState().index).toBe(1);
    });

    it("lässt Strg+Pfeil im Textfeld in Ruhe", () => {
      renderHook(() => useKeyboardShortcuts(), { wrapper });
      const input = document.createElement("input");
      document.body.append(input);
      const event = press({ code: "ArrowRight", key: "ArrowRight", ctrlKey: true }, input);
      expect(event.defaultPrevented).toBe(false);
      expect(usePlayer.getState().index).toBe(0);
      input.remove();
    });

    it("Strg+K fokussiert das Suchfeld", () => {
      renderHook(() => useKeyboardShortcuts(), { wrapper });
      const input = document.createElement("input");
      input.setAttribute("data-search", "");
      document.body.append(input);
      press({ code: "KeyK", key: "k", ctrlKey: true });
      expect(document.activeElement).toBe(input);
      input.remove();
    });
  });
});

describe("Server hinzufügen", () => {
  beforeEach(() => {
    useSession.setState({ ready: true, creds, client: new SubsonicClient(creds) });
  });
  afterEach(() => vi.restoreAllMocks());

  function fillForm() {
    fireEvent.click(screen.getByRole("button", { name: /Server hinzufügen/ }));
    fireEvent.change(screen.getByLabelText(/Navidrome/), { target: { value: "https://zwei.example" } });
    fireEvent.change(screen.getByLabelText("Benutzername"), { target: { value: "anna" } });
    fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: "geheim" } });
  }

  it("bleibt bei einem Fehler angemeldet", async () => {
    const login = vi.spyOn(useSession.getState(), "login").mockRejectedValue(new Error("down"));
    useSession.setState({ login });
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fillForm();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Hinzufügen und wechseln/ }).closest("form")); });
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(useSession.getState().creds).toBe(creds);
    expect(login).toHaveBeenCalledWith("https://zwei.example", "anna", "geheim");
  });

  it("schließt das Formular nach dem Wechsel", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    useSession.setState({ login });
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fillForm();
    await act(async () => { fireEvent.submit(screen.getByRole("button", { name: /Hinzufügen und wechseln/ }).closest("form")); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Server hinzufügen/ })).toBeTruthy());
  });
});
