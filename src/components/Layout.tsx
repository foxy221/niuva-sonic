import { Link, Outlet } from "react-router-dom";
import { useSession } from "../state/session";
import PlayerBar from "./PlayerBar";

export default function Layout() {
  const { creds, logout } = useSession();

  return (
    <div className="app">
      <div className="content">
        <header className="topbar">
          <Link to="/" className="topbar-logo"><img src="/logo.png" alt="Niuva Sonic" /></Link>
          <nav className="topbar-nav" aria-label="Hauptnavigation">
            <Link to="/">Start</Link>
            <Link to="/search">Suche</Link>
            <Link to="/artists">Künstler</Link>
            <Link to="/albums">Alben</Link>
            <Link to="/genres">Genres</Link>
            <Link to="/favorites">Favoriten</Link>
            <Link to="/playlists">Playlists</Link>
          </nav>
          <span className="topbar-user">{creds?.username}</span>
          <button className="ghost" onClick={logout}>Abmelden</button>
        </header>
        <Outlet />
      </div>
      <PlayerBar />
    </div>
  );
}
