import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { SubsonicClient } from "../src/api/subsonic";
import { isTypingTarget, useKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { runPlayerCommand, usePlayerCommands } from "../src/hooks/usePlayerCommands";
import { describeUpdate } from "../src/screens/Settings";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const credentials = { serverUrl: "https://music-a.example", username: "A", token: "a".repeat(32), salt: "salt" };
const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
const song = (id, duration = 100) => ({ id, title: id.toUpperCase(), duration });

function pressSpace(target) {
  const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
  (target ?? window).dispatchEvent(event);
  return event;
}

beforeEach(() => {
  localStorage.clear();
  usePlayer.getState().reset();
  useSession.setState({ ready: true, creds: credentials, client: new SubsonicClient(credentials) });
  vi.spyOn(SubsonicClient.prototype, "scrobble").mockResolvedValue({});
});

afterEach(() => {
  delete window.__TAURI_INTERNALS__;
});

describe("Leertaste (#12)", () => {
  it("hält an und spielt weiter", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    expect(usePlayer.getState().playing).toBe(true);

    pressSpace();
    expect(usePlayer.getState().playing).toBe(false);

    pressSpace();
    expect(usePlayer.getState().playing).toBe(true);
  });

  it("lässt Eingabefelder und Knöpfe in Ruhe", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper });

    for (const tag of ["input", "textarea", "select", "button"]) {
      const element = document.createElement(tag);
      document.body.append(element);
      const event = pressSpace(element);
      expect(event.defaultPrevented).toBe(false);
      element.remove();
    }

    expect(usePlayer.getState().playing).toBe(true);
  });

  it("greift nicht mit Zusatztasten", () => {
    usePlayer.getState().playQueue([song("a")], 0);
    renderHook(() => useKeyboardShortcuts(), { wrapper });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", ctrlKey: true, cancelable: true }));
    expect(usePlayer.getState().playing).toBe(true);
  });
});

describe("isTypingTarget (#12)", () => {
  it("erkennt Felder, Knöpfe und Rollen", () => {
    for (const tag of ["input", "textarea", "select", "button"]) {
      expect(isTypingTarget(document.createElement(tag))).toBe(true);
    }
    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");
    expect(isTypingTarget(textbox)).toBe(true);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });
});

describe("Befehle aus der Hülle (#13)", () => {
  it("setzt Tray- und Medientasten-Befehle in Player-Aktionen um", () => {
    usePlayer.getState().playQueue([song("a"), song("b")], 0);

    runPlayerCommand("next");
    expect(usePlayer.getState().index).toBe(1);

    runPlayerCommand("toggle");
    expect(usePlayer.getState().playing).toBe(false);

    runPlayerCommand("previous");
    expect(usePlayer.getState().index).toBe(0);
  });

  it("hört nur in der installierten App auf die Hülle", () => {
    renderHook(() => usePlayerCommands());
    expect(listen).not.toHaveBeenCalled();
  });

  it("nimmt Ereignisse an und meldet sich beim Abbau wieder ab", async () => {
    window.__TAURI_INTERNALS__ = {};
    let handler;
    const unlisten = vi.fn();
    vi.mocked(listen).mockImplementation((_event, callback) => {
      handler = callback;
      return Promise.resolve(unlisten);
    });

    usePlayer.getState().playQueue([song("a"), song("b")], 0);
    const { unmount } = renderHook(() => usePlayerCommands());

    await waitFor(() => expect(listen).toHaveBeenCalledWith("player-command", expect.any(Function)));
    handler({ payload: "next" });
    expect(usePlayer.getState().index).toBe(1);

    unmount();
    await waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});

describe("Update-Text (#14)", () => {
  it("beschreibt alle Zustände verständlich", () => {
    const base = { currentVersion: "0.1.0", version: null, message: null };
    expect(describeUpdate(null)).toBe("Noch nicht geprüft.");
    expect(describeUpdate({ ...base, state: "notConfigured" })).toContain("noch nicht eingerichtet");
    expect(describeUpdate({ ...base, state: "upToDate" })).toContain("ist aktuell");
    expect(describeUpdate({ ...base, state: "available", version: "0.2.0" })).toContain("0.2.0");
    expect(describeUpdate({ ...base, state: "error", message: "Kein Netz" })).toContain("Kein Netz");
  });
});
