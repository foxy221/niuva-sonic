import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { SubsonicClient } from "../src/api/subsonic";
import { useSession } from "../src/state/session";
import { usePlayer } from "../src/state/player";
import { useStar } from "../src/hooks/favorites";
import { useUi } from "../src/design/ui";
import SongList from "../src/components/SongList";
import AlbumGrid from "../src/components/AlbumGrid";
import FullPlayer from "../src/components/FullPlayer";

// Der Visualizer zeichnet auf ein Canvas und braucht Browser-Schnittstellen, die jsdom nicht hat.
vi.mock("../src/components/Visualizer", () => ({ default: () => null }));

/**
 * Fehler aus der gemeinsamen Windows-Abnahme: Herz im Vollbild, Playlist-Menü an
 * Titelzeilen, Pfeile und Ziehen in Reihen, Warteschlange im Vollbild.
 */

let cache;
const credentials = { serverUrl: "https://music.example", username: "test", token: "a".repeat(32), salt: "salt" };
const song = (id) => ({ id, title: `Titel ${id}`, artist: "K", album: "A", albumId: "al-1", duration: 100 });

function Wrapper({ children }) {
  return <QueryClientProvider client={cache}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

beforeEach(() => {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } });
  useSession.setState({ ready: true, creds: credentials, client: new SubsonicClient(credentials) });
  usePlayer.getState().reset();
  useUi.setState({ queueOpen: false, fullOpen: false });
});
afterEach(() => { cache.clear(); usePlayer.getState().reset(); });

describe("Herz im Vollbild", () => {
  it("zieht den Favoritenstatus der Titel in der Warteschlange nach", async () => {
    vi.spyOn(SubsonicClient.prototype, "star").mockResolvedValue({});
    vi.spyOn(SubsonicClient.prototype, "unstar").mockResolvedValue({});
    usePlayer.setState({ queue: [song("a"), song("b")], index: 0, unshuffled: null });
    const { result } = renderHook(() => useStar(), { wrapper: Wrapper });

    await act(async () => { await result.current.mutateAsync({ ids: { id: ["a"] }, starred: false }); });
    expect(usePlayer.getState().queue[0].starred).toBeTruthy();
    expect(usePlayer.getState().queue[1].starred).toBeUndefined();

    await act(async () => { await result.current.mutateAsync({ ids: { id: ["a"] }, starred: true }); });
    expect(usePlayer.getState().queue[0].starred).toBeUndefined();
  });

  it("zeigt im Vollbild-Player das aktuelle Herz und schaltet es um", async () => {
    vi.spyOn(SubsonicClient.prototype, "star").mockResolvedValue({});
    usePlayer.setState({ queue: [song("a")], index: 0, unshuffled: null });
    useUi.setState({ fullOpen: true });
    render(<FullPlayer />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Titel zu Favoriten hinzufügen" }));

    await screen.findByRole("button", { name: "Titel aus Favoriten entfernen" });
  });
});

describe("Warteschlange im Vollbild", () => {
  it("öffnet die Warteschlange, ohne den Vollbild-Player zu verlassen", () => {
    // jsdom kennt scrollIntoView nicht; das Panel scrollt damit zum laufenden Titel.
    Element.prototype.scrollIntoView = () => {};
    usePlayer.setState({ queue: [song("a"), song("b")], index: 0, unshuffled: null });
    useUi.setState({ fullOpen: true });
    render(<FullPlayer />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Warteschlange" }));

    expect(useUi.getState().fullOpen).toBe(true);
    expect(useUi.getState().queueOpen).toBe(true);
    expect(screen.getByRole("complementary", { name: "Warteschlange" })).toBeTruthy();
  });
});

describe("Titel zu einer Playlist hinzufügen", () => {
  it("hängt einen einzelnen Titel an die gewählte Playlist", async () => {
    vi.spyOn(SubsonicClient.prototype, "getPlaylists").mockResolvedValue([
      { id: "p1", name: "Meine Liste", songCount: 0 },
      { id: "p2", name: "Vom Server", songCount: 3, readonly: true },
    ]);
    const update = vi.spyOn(SubsonicClient.prototype, "updatePlaylist").mockResolvedValue({});
    render(<SongList songs={[song("a")]} onPlay={() => {}} downloads={false} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Zu Playlist hinzufügen" }));
    // Schreibgeschützte Playlists werden nicht angeboten.
    expect(await screen.findByRole("menuitem", { name: "Meine Liste" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Vom Server" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Meine Liste" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ playlistId: "p1", songIdsToAdd: ["a"] }));
  });

  it("schließt das Menü mit Escape", async () => {
    vi.spyOn(SubsonicClient.prototype, "getPlaylists").mockResolvedValue([{ id: "p1", name: "Meine Liste", songCount: 0 }]);
    render(<SongList songs={[song("a")]} onPlay={() => {}} downloads={false} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole("button", { name: "Zu Playlist hinzufügen" }));
    await screen.findByRole("menu");
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Reihen mit Pfeilen", () => {
  const albums = Array.from({ length: 12 }, (_, i) => ({ id: `al-${i}`, name: `Album ${i}`, artist: "K" }));
  const define = (name, value) => Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: value });

  afterEach(() => {
    for (const name of ["scrollWidth", "clientWidth"]) delete HTMLElement.prototype[name];
  });

  it("zeigt Pfeile nur in Richtungen, in die sich scrollen lässt", async () => {
    define("scrollWidth", () => 2000);
    define("clientWidth", () => 500);
    render(<AlbumGrid albums={albums} row />, { wrapper: Wrapper });

    // Ganz links: nur „weiter nach rechts“.
    expect(screen.queryByRole("button", { name: "Nach links blättern" })).toBeNull();
    expect(screen.getByRole("button", { name: "Nach rechts blättern" })).toBeTruthy();

    const list = document.querySelector("ul.row");
    list.scrollLeft = 300;
    fireEvent.scroll(list);
    await screen.findByRole("button", { name: "Nach links blättern" });
    expect(screen.getByRole("button", { name: "Nach rechts blättern" })).toBeTruthy();

    list.scrollLeft = 1500;
    fireEvent.scroll(list);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Nach rechts blättern" })).toBeNull());
    expect(screen.getByRole("button", { name: "Nach links blättern" })).toBeTruthy();
  });

  it("zeigt keine Pfeile, wenn alles in die Breite passt", () => {
    define("scrollWidth", () => 500);
    define("clientWidth", () => 500);
    render(<AlbumGrid albums={albums.slice(0, 2)} row />, { wrapper: Wrapper });

    expect(screen.queryByRole("button", { name: /blättern/ })).toBeNull();
  });

  it("scrollt mit der Maus beim Ziehen und lässt einen einfachen Klick durch", () => {
    define("scrollWidth", () => 2000);
    define("clientWidth", () => 500);
    render(<AlbumGrid albums={albums} row />, { wrapper: Wrapper });
    const list = document.querySelector("ul.row");

    fireEvent.pointerDown(list, { pointerType: "mouse", button: 0, clientX: 400 });
    fireEvent.pointerMove(list, { pointerType: "mouse", clientX: 398 });
    expect(list.scrollLeft).toBe(0);
    fireEvent.pointerMove(list, { pointerType: "mouse", clientX: 300 });
    expect(list.scrollLeft).toBe(100);
    fireEvent.pointerUp(list, { pointerType: "mouse" });
  });
});
