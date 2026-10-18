import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useSession } from "./state/session";
import Login from "./screens/Login";
import Home from "./screens/Home";
import Albums from "./screens/Albums";
import Album from "./screens/Album";
import Artists from "./screens/Artists";
import Artist from "./screens/Artist";
import Genres from "./screens/Genres";
import Genre from "./screens/Genre";
import Favorites from "./screens/Favorites";
import Playlists from "./screens/Playlists";
import Playlist from "./screens/Playlist";
import Search from "./screens/Search";
import Settings from "./screens/Settings";
import Offline from "./screens/Offline";
import OfflineAlbum from "./screens/OfflineAlbum";
import Layout from "./components/Layout";
import { useDesktopExit } from "./hooks/useDesktopExit";

export default function App() {
  useDesktopExit();
  const { ready, client, restore } = useSession();

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) return null;
  if (!client) return <Login />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="artists" element={<Artists />} />
          <Route path="artist/:id" element={<Artist />} />
          <Route path="albums" element={<Albums />} />
          <Route path="album/:id" element={<Album />} />
          <Route path="genres" element={<Genres />} />
          <Route path="genre/:name" element={<Genre />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="playlists" element={<Playlists />} />
          <Route path="playlist/:id" element={<Playlist />} />
          <Route path="offline" element={<Offline />} />
          <Route path="offline/album/:id" element={<OfflineAlbum />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
