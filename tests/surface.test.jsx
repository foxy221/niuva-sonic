import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { mosaicSongs } from "../src/components/PlaylistCover";
import SeekBar from "../src/components/SeekBar";
import TopBar from "../src/components/TopBar";
import { usePlayer } from "../src/state/player";
import { useSession } from "../src/state/session";

const song = (id, coverArt, albumId) => ({ id, title: id, coverArt, albumId });

describe("Playlist-Mosaik", () => {
  it("nimmt höchstens vier Titel mit verschiedenen Covern", () => {
    const songs = [song("1", "c1"), song("2", "c1"), song("3", "c2"), song("4", "c3"), song("5", "c4"), song("6", "c5")];
    expect(mosaicSongs(songs).map((s) => s.id)).toEqual(["1", "3", "4", "5"]);
  });
  it("überspringt Titel ohne Cover und verträgt fehlende Liste", () => {
    expect(mosaicSongs([song("1"), song("2", "c1")]).map((s) => s.id)).toEqual(["2"]);
    expect(mosaicSongs(undefined)).toEqual([]);
  });
});

describe("Fortschrittsbalken", () => {
  it("zeigt beim Überfahren die Zeit am Mauszeiger", () => {
    usePlayer.setState({ position: 0, duration: 200 });
    const { container } = render(<SeekBar />);
    const range = container.querySelector("input.range");
    range.getBoundingClientRect = () => ({ left: 100, width: 400, top: 0, height: 16, right: 500, bottom: 16, x: 100, y: 0, toJSON() {} });
    expect(container.querySelector(".seek-preview")).toBeNull();
    fireEvent.pointerMove(range, { clientX: 300 });
    expect(container.querySelector(".seek-preview").textContent).toBe("1:40");
    fireEvent.pointerLeave(range);
    expect(container.querySelector(".seek-preview")).toBeNull();
  });
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

describe("Obere Leiste", () => {
  beforeEach(() => useSession.setState({ creds: { serverUrl: "https://x", username: "mia", token: "t", salt: "s" } }));

  it("sucht über das Feld und zeigt das Profil", () => {
    render(
      <MemoryRouter initialEntries={["/albums"]}>
        <TopBar />
        <Routes><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("mia")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Suche"), { target: { value: "Daft Punk" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByTestId("where").textContent).toBe("/search?q=Daft%20Punk");
  });

  it("blendet das Feld auf der Suchseite aus", () => {
    render(<MemoryRouter initialEntries={["/search"]}><TopBar /></MemoryRouter>);
    expect(screen.queryByLabelText("Suche")).toBeNull();
  });
});
