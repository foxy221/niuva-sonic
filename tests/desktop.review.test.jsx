import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
const Router = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "../src/state/desktop";
import { useKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { usePlayerCommands } from "../src/hooks/usePlayerCommands";
import { useDesktopExit } from "../src/hooks/useDesktopExit";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";
import { SubsonicClient } from "../src/api/subsonic";
import Settings from "../src/screens/Settings";
import { deferred } from "./setup";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  useSession.setState({ creds: null, client: null });
  vi.mocked(listen).mockResolvedValue(vi.fn());
  vi.mocked(invoke).mockResolvedValue(undefined);
});
afterEach(() => { delete window.__TAURI_INTERNALS__; });

describe("Desktop-Grenzen und Listener", () => {
  it("zeigt Windows-Funktionen nicht in der Android-Tauri-App", () => {
    window.__TAURI_INTERNALS__ = {};
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14)");
    expect(isDesktopApp()).toBe(false);
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(screen.queryByRole("switch", { name: "Medientasten abfangen" })).toBeNull();
  });

  it("ignoriert Tray-Ereignisse nach dem Abbau schon vor der asynchronen Abmeldung", async () => {
    window.__TAURI_INTERNALS__ = {};
    const pending = deferred();
    let handler;
    vi.mocked(listen).mockImplementation((_name, callback) => { handler = callback; return pending.promise; });
    const next = vi.spyOn(usePlayer.getState(), "next");
    const { unmount } = renderHook(() => usePlayerCommands());
    unmount();
    handler({ payload: "next" });
    expect(next).not.toHaveBeenCalled();
    const stop = vi.fn();
    await act(async () => { pending.resolve(stop); });
    expect(stop).toHaveBeenCalledOnce();
  });

  it("fängt eine fehlgeschlagene Listener-Anmeldung ab", async () => {
    window.__TAURI_INTERNALS__ = {};
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listen).mockRejectedValue(new Error("IPC nicht verfügbar"));
    renderHook(() => usePlayerCommands());
    await waitFor(() => expect(log).toHaveBeenCalledOnce());
  });
});

describe("Lokale Leertaste", () => {
  it.each(["button span", "button svg", "[role=button]", "[role=switch]", "[role=checkbox]"])("beeinflusst %s nicht", (selector) => {
    const toggle = vi.spyOn(usePlayer.getState(), "toggle");
    renderHook(() => useKeyboardShortcuts(), { wrapper: Router });
    const container = document.createElement("div");
    container.innerHTML = '<button><span>Text</span><svg></svg></button><div role="button"></div><div role="switch"></div><div role="checkbox"></div>';
    document.body.append(container);
    const event = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    container.querySelector(selector).dispatchEvent(event);
    expect(toggle).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    container.remove();
  });

  it("greift nicht während einer IME-Eingabe", () => {
    const toggle = vi.spyOn(usePlayer.getState(), "toggle");
    renderHook(() => useKeyboardShortcuts(), { wrapper: Router });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", isComposing: true, cancelable: true }));
    expect(toggle).not.toHaveBeenCalled();
  });
});

describe("Geordnetes Beenden", () => {
  it("bestätigt Beenden erst nach dem Speichern und verarbeitet doppelte Signale nur einmal", async () => {
    window.__TAURI_INTERNALS__ = {};
    const pending = deferred();
    const flush = vi.spyOn(usePlayer.getState(), "flush").mockReturnValue(pending.promise);
    let handler;
    vi.mocked(listen).mockImplementation((_event, callback) => { handler = callback; return Promise.resolve(vi.fn()); });
    renderHook(() => useDesktopExit());
    handler(); handler();
    expect(flush).toHaveBeenCalledOnce();
    expect(invoke).not.toHaveBeenCalledWith("finish_exit");
    await act(async () => { pending.resolve(); });
    expect(invoke).toHaveBeenCalledWith("finish_exit");
    expect(invoke).toHaveBeenCalledOnce();
  });

  it("erlaubt Beenden auch bei einem Speicherfehler", async () => {
    window.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(usePlayer.getState(), "flush").mockRejectedValue(new Error("Disk voll"));
    let handler;
    vi.mocked(listen).mockImplementation((_event, callback) => { handler = callback; return Promise.resolve(vi.fn()); });
    renderHook(() => useDesktopExit());
    handler();
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("finish_exit"));
  });

  it("schreibt beim Flush sofort die aktuelle Position statt auf den Save-Timer zu warten", async () => {
    const credentials = { serverUrl: "https://example.org", username: "A", token: "a".repeat(32), salt: "salt" };
    vi.spyOn(SubsonicClient.prototype, "scrobble").mockResolvedValue({});
    useSession.setState({ creds: credentials, client: new SubsonicClient(credentials) });
    await usePlayer.getState().restore();
    usePlayer.getState().playQueue([{ id: "a", title: "A", duration: 100 }]);
    usePlayer.getState().seek(42);
    await usePlayer.getState().flush();
    expect(JSON.parse(localStorage.getItem("playerQueue"))).toMatchObject({ position: 42, index: 0 });
    usePlayer.getState().reset();
  });
});

describe("Windows-Einstellungen", () => {
  function setupInvokes(check) {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "window_prefs") return Promise.resolve({ closeToTray: true, globalShortcuts: false });
      if (command === "tray_ready") return Promise.resolve(true);
      if (command === "check_for_update") return check();
      return Promise.resolve({ closeToTray: false, globalShortcuts: false });
    });
  }

  it("verwirft die alte Initialisierung nach dem Strict-Mode-Neustart", async () => {
    const old = deferred();
    setupInvokes(() => Promise.resolve({ state: "notConfigured", currentVersion: "0.1.0" }));
    const original = invoke.getMockImplementation();
    let reads = 0;
    vi.mocked(invoke).mockImplementation((command, args) => {
      if (command === "window_prefs" && ++reads === 1) return old.promise;
      return original(command, args);
    });
    render(<StrictMode><MemoryRouter><Settings /></MemoryRouter></StrictMode>);
    const close = await screen.findByRole("switch", { name: "Beim Schließen in den Tray" });
    fireEvent.click(close);
    await waitFor(() => expect(close.checked).toBe(false));
    await act(async () => { old.resolve({ closeToTray: true, globalShortcuts: true }); });
    expect(close.checked).toBe(false);
  });

  it("sperrt beide Windows-Schalter bis zur Antwort", async () => {
    const pending = deferred();
    setupInvokes(() => Promise.resolve({ state: "notConfigured", currentVersion: "0.1.0" }));
    const original = invoke.getMockImplementation();
    vi.mocked(invoke).mockImplementation((command, args) => command === "set_close_to_tray" ? pending.promise : original(command, args));
    render(<MemoryRouter><Settings /></MemoryRouter>);
    const close = await screen.findByRole("switch", { name: "Beim Schließen in den Tray" });
    fireEvent.click(close);
    expect(close.disabled).toBe(true);
    expect(screen.getByRole("switch", { name: "Medientasten abfangen" }).disabled).toBe(true);
    await act(async () => { pending.resolve({ closeToTray: false, globalShortcuts: false }); });
    expect(close.checked).toBe(false);
    expect(close.disabled).toBe(false);
  });

  it("ersetzt ein neues Update-Ergebnis nicht durch die verspätete automatische Prüfung", async () => {
    const old = deferred();
    const check = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ state: "available", currentVersion: "0.1.0", version: "0.2.0" });
    setupInvokes(check);
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Nach Updates suchen" }));
    await screen.findByText(/0.2.0 steht bereit/);
    await act(async () => { old.resolve({ state: "upToDate", currentVersion: "0.1.0" }); });
    expect(screen.getByText(/0.2.0 steht bereit/)).toBeTruthy();
  });
});

describe("Update-Ablauf", () => {
  const available = { state: "available", currentVersion: "0.1.0", version: "0.2.0", message: null };

  function setupUpdate(extra) {
    window.__TAURI_INTERNALS__ = {};
    vi.mocked(invoke).mockImplementation((command) => {
      if (command === "window_prefs") return Promise.resolve({ closeToTray: true, globalShortcuts: false });
      if (command === "tray_ready") return Promise.resolve(true);
      if (command === "check_for_update") return Promise.resolve(available);
      return extra(command);
    });
  }

  it("lädt, sichert den Player-Zustand und spielt dann erst ein", async () => {
    const order = [];
    vi.spyOn(usePlayer.getState(), "flush").mockImplementation(async () => { order.push("flush"); });
    setupUpdate((command) => { if (command.endsWith("_update")) order.push(command); return Promise.resolve(command === "download_update" ? "0.2.0" : undefined); });
    render(<MemoryRouter><Settings /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Version 0.2.0 laden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Installieren und neu starten" }));

    await waitFor(() => expect(order).toEqual(["download_update", "flush", "install_update"]));
  });

  it("meldet einen fehlgeschlagenen Download und bietet das Laden erneut an", async () => {
    setupUpdate((command) => (command === "download_update" ? Promise.reject("Signatur ungültig") : Promise.resolve()));
    render(<MemoryRouter><Settings /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Version 0.2.0 laden" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Signatur ungültig");
    expect(screen.getByRole("button", { name: "Version 0.2.0 laden" })).toBeTruthy();
  });

  it("bleibt bei einem Fehler beim Einspielen bedienbar", async () => {
    vi.spyOn(usePlayer.getState(), "flush").mockResolvedValue(undefined);
    setupUpdate((command) => {
      if (command === "download_update") return Promise.resolve("0.2.0");
      if (command === "install_update") return Promise.reject("Installer nicht gestartet");
      return Promise.resolve();
    });
    render(<MemoryRouter><Settings /></MemoryRouter>);

    fireEvent.click(await screen.findByRole("button", { name: "Version 0.2.0 laden" }));
    fireEvent.click(await screen.findByRole("button", { name: "Installieren und neu starten" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Installer nicht gestartet");
    expect(screen.getByRole("button", { name: "Installieren und neu starten" }).disabled).toBe(false);
  });
});
