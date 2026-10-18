import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Disc3, Heart, House, ListMusic, LogOut, Mic2, Search, Tags } from "lucide-react";
import { useNowPlayingAccent } from "../design/useAccent";
import { useSession } from "../state/session";
import { usePlayer } from "../state/player";
import FullPlayer from "./FullPlayer";
import PlayerBar from "./PlayerBar";
import QueuePanel from "./QueuePanel";

const NAV = [
  { to: "/", label: "Start", Icon: House, end: true },
  { to: "/search", label: "Suche", Icon: Search },
  { to: "/artists", label: "Künstler", Icon: Mic2 },
  { to: "/albums", label: "Alben", Icon: Disc3 },
  { to: "/genres", label: "Genres", Icon: Tags },
  { to: "/favorites", label: "Favoriten", Icon: Heart },
  { to: "/playlists", label: "Playlists", Icon: ListMusic },
];

export default function Layout() {
  const { client, creds, logout } = useSession();
  const navigate = useNavigate();
  const cover = usePlayer((s) => s.queue[s.index]?.coverArt);
  useNowPlayingAccent(cover && client ? client.coverArtUrl(cover, 64) : undefined);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo"><img src="/logo.png" alt="Niuva Sonic" /></Link>
        <nav className="nav" aria-label="Hauptnavigation">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{creds?.username.slice(0, 1)}</span>
          <span>{creds?.username}</span>
          <button className="icon" onClick={logout} aria-label="Abmelden" title="Abmelden"><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="content">
        <div className="topbar">
          <button className="icon" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={22} /></button>
          <button className="icon" onClick={() => navigate(1)} aria-label="Vor"><ChevronRight size={22} /></button>
        </div>
        <Outlet />
      </main>
      <QueuePanel />
      <PlayerBar />
      <FullPlayer />
    </div>
  );
}
