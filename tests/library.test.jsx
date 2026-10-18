import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SubsonicClient } from "../src/api/subsonic";
import { useSession } from "../src/state/session";
import { useStar } from "../src/hooks/favorites";
import { useAlbum } from "../src/hooks/library";
import FavoriteButton from "../src/components/FavoriteButton";
import Genre from "../src/screens/Genre";
import Playlist from "../src/screens/Playlist";
import { deferred } from "./setup";

let cache;
const credentials = { serverUrl: "https://music.example", username: "test", token: "a".repeat(32), salt: "salt" };

function Wrapper({ children }) {
  return <QueryClientProvider client={cache}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } });
  useSession.setState({ ready: true, creds: credentials, client: new SubsonicClient(credentials) });
});

afterEach(() => { cache.clear(); });

describe("Favoriten (#3)", () => {
  it.each([
    [{ albumId: ["a"] }, ["starred", "search", "album", "albumList", "artist"]],
    [{ artistId: ["ar"] }, ["starred", "search", "artist", "artists", "artistInfo"]],
    [{ id: ["s"] }, ["starred", "search", "album", "songsByGenre", "playlist"]],
  ])("invalidiert alle betroffenen Darstellungen für %j", async (ids, expected) => {
    vi.spyOn(SubsonicClient.prototype, "star").mockResolvedValue({});
    for (const prefix of expected) cache.setQueryData([prefix, "test"], { starred: false });
    const { result } = renderHook(() => useStar(), { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync({ ids, starred: false }); });
    for (const prefix of expected) expect(cache.getQueryState([prefix, "test"]).isInvalidated, prefix).toBe(true);
  });

  it("hält das Albumherz bis zum Refetch gesperrt und entfernt beim nächsten Klick den Favoriten", async () => {
    let starred = false;
    const refreshed = deferred();
    const album = () => ({ id: "a", name: "Album", starred: starred ? "2026-10-18" : undefined });
    const getAlbum = vi.spyOn(SubsonicClient.prototype, "getAlbum").mockImplementation(async () => album());
    const star = vi.spyOn(SubsonicClient.prototype, "star").mockImplementation(async () => { starred = true; });
    const unstar = vi.spyOn(SubsonicClient.prototype, "unstar").mockImplementation(async () => { starred = false; });
    function AlbumHeart() {
      const query = useAlbum("a");
      return query.data ? <FavoriteButton albumId="a" label="Album" starred={Boolean(query.data.starred)} /> : null;
    }
    render(<AlbumHeart />, { wrapper: Wrapper });
    const add = await screen.findByRole("button", { name: "Album zu Favoriten hinzufügen" });
    getAlbum.mockImplementationOnce(() => refreshed.promise);
    fireEvent.click(add);
    await waitFor(() => expect(star).toHaveBeenCalledOnce());
    await waitFor(() => expect(add.disabled).toBe(true));
    expect(unstar).not.toHaveBeenCalled();
    await act(async () => { refreshed.resolve(album()); });
    const remove = await screen.findByRole("button", { name: "Album aus Favoriten entfernen" });
    await waitFor(() => expect(remove.disabled).toBe(false));
    fireEvent.click(remove);
    await waitFor(() => expect(unstar).toHaveBeenCalledOnce());
    await screen.findByRole("button", { name: "Album zu Favoriten hinzufügen" });
    expect(star).toHaveBeenCalledOnce();
  });
});

describe("Genre-Routen (#4)", () => {
  it.each(["100%", "%20", "ÄÖÜ", "R&B", "Rock/Pop", "Space Rock"])("lädt %s unverändert", async (name) => {
    const request = vi.spyOn(SubsonicClient.prototype, "getSongsByGenre").mockResolvedValue([]);
    render(
      <MemoryRouter initialEntries={[`/genre/${encodeURIComponent(name)}`]}>
        <Routes><Route path="/genre/:name" element={<Genre />} /></Routes>
      </MemoryRouter>, { wrapper: Wrapper },
    );
    expect(screen.getByRole("heading", { name, exact: true })).toBeTruthy();
    await waitFor(() => expect(request).toHaveBeenCalledWith(name, 100, 0));
    await screen.findByText("Keine Titel in diesem Genre.");
  });
});

function renderPlaylist() {
  render(
    <MemoryRouter initialEntries={["/playlist/p"]}>
      <Routes><Route path="/playlist/:id" element={<Playlist />} /></Routes>
    </MemoryRouter>, { wrapper: Wrapper },
  );
}

describe("Playlist-Entfernen (#5)", () => {
  it("sperrt schnelle Folgeklicks bis nach dem Refetch und verwendet danach die neuen Indizes", async () => {
    let entries = ["A", "B", "C"].map((title) => ({ id: title, title }));
    const snapshot = () => ({ id: "p", name: "Test", entry: [...entries] });
    const response = deferred();
    const refreshed = deferred();
    const getPlaylist = vi.spyOn(SubsonicClient.prototype, "getPlaylist").mockResolvedValueOnce(snapshot()).mockImplementation(() => refreshed.promise);
    const update = vi.spyOn(SubsonicClient.prototype, "updatePlaylist").mockImplementation(async ({ songIndexesToRemove }) => {
      entries.splice(songIndexesToRemove[0], 1);
      await response.promise;
    });
    renderPlaylist();
    const buttons = await screen.findAllByRole("button", { name: "Entfernen" });
    // Beide Ereignisse ohne dazwischenliegenden Render auslösen.
    act(() => { buttons[0].click(); buttons[1].click(); });
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(buttons.every((button) => button.disabled)).toBe(true));
    await act(async () => { response.resolve(); });
    await waitFor(() => expect(getPlaylist).toHaveBeenCalledTimes(2));
    expect(buttons.every((button) => button.disabled)).toBe(true);
    getPlaylist.mockImplementation(async () => snapshot());
    await act(async () => { refreshed.resolve(snapshot()); });
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Entfernen" })).toHaveLength(2));
    const next = screen.getAllByRole("button", { name: "Entfernen" })[0];
    await waitFor(() => expect(next.disabled).toBe(false));
    fireEvent.click(next);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Entfernen" })).toHaveLength(1));
    expect(entries.map((song) => song.title)).toEqual(["C"]);
    expect(update.mock.calls.map(([input]) => input.songIndexesToRemove)).toEqual([[0], [0]]);
  });

  it("gleicht die Liste auch ab, wenn die Änderung auf dem Server erfolgt, aber die Antwort verloren geht", async () => {
    let entries = [{ id: "A", title: "A" }, { id: "B", title: "B" }];
    vi.spyOn(SubsonicClient.prototype, "getPlaylist").mockImplementation(async () => ({ id: "p", name: "Test", entry: [...entries] }));
    vi.spyOn(SubsonicClient.prototype, "updatePlaylist").mockImplementation(async () => {
      entries = entries.slice(1);
      throw new Error("Antwort verloren");
    });
    renderPlaylist();
    fireEvent.click((await screen.findAllByRole("button", { name: "Entfernen" }))[0]);
    await screen.findByText("Antwort verloren");
    expect(screen.getAllByRole("button", { name: "Entfernen" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /B/ })).toBeTruthy();
  });

  it("bietet nach einem fehlgeschlagenen Refetch keine veralteten Entfernen-Aktionen an", async () => {
    vi.spyOn(SubsonicClient.prototype, "getPlaylist")
      .mockResolvedValueOnce({ id: "p", name: "Test", entry: [{ id: "A", title: "A" }] })
      .mockRejectedValue(new Error("Playlist nicht erreichbar"));
    vi.spyOn(SubsonicClient.prototype, "updatePlaylist").mockResolvedValue({});
    renderPlaylist();
    fireEvent.click(await screen.findByRole("button", { name: "Entfernen" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Entfernen" })).toBeNull();
  });
});
