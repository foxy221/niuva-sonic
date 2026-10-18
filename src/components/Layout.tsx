import { Fragment } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { Disc3, Download, Heart, House, ListMusic, LogOut, Mic2, Search, Settings, Stethoscope, Tags } from "lucide-react";
import { useNowPlayingAccent } from "../design/useAccent";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { usePlayerCommands } from "../hooks/usePlayerCommands";
import { useSession } from "../state/session";
import { usePlayer } from "../state/player";
import { useUi } from "../design/ui";
import { useCoverUrl } from "../hooks/useCoverUrl";
import { useT, type MessageKey } from "../i18n";
import FullPlayer from "./FullPlayer";
import PlayerBar from "./PlayerBar";
import QueuePanel from "./QueuePanel";
import TopBar from "./TopBar";

const NAV: { to: string; label: MessageKey; Icon: typeof House; end?: boolean }[] = [
  { to: "/", label: "nav.home", Icon: House, end: true },
  { to: "/search", label: "nav.search", Icon: Search },
  { to: "/artists", label: "nav.artists", Icon: Mic2 },
  { to: "/albums", label: "nav.albums", Icon: Disc3 },
  { to: "/genres", label: "nav.genres", Icon: Tags },
  { to: "/favorites", label: "nav.favorites", Icon: Heart },
  { to: "/playlists", label: "nav.playlists", Icon: ListMusic },
  { to: "/offline", label: "nav.offline", Icon: Download },
  { to: "/settings", label: "nav.settings", Icon: Settings },
  { to: "/diagnostics", label: "nav.diagnostics", Icon: Stethoscope },
];

export default function Layout() {
  const t = useT();
  const { creds, logout } = useSession();
  const { pathname } = useLocation();
  const fullOpen = useUi((s) => s.fullOpen);
  const current = usePlayer((s) => s.queue[s.index]);
  useNowPlayingAccent(useCoverUrl(current?.coverArt, current?.albumId, 64));
  // Leertaste im Fenster sowie Befehle aus Tray-Menü und Medientasten.
  useKeyboardShortcuts();
  usePlayerCommands();

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo"><img src="/logo.png" alt="Niuva Sonic" /></Link>
        <nav className="nav" aria-label={t("nav.main")}>
          {NAV.map(({ to, label, Icon, end }) => (
            <Fragment key={to}>
              {to === "/settings" && <div className="nav-divider" />}
              <NavLink to={to} end={end}>
                <Icon size={20} /> {t(label)}
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{creds?.username.slice(0, 1)}</span>
          <span>{creds?.username}</span>
          <button className="icon" onClick={logout} aria-label={t("nav.logout")} title={t("nav.logout")}><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="content">
        <TopBar />
        <div className="page" key={pathname}>
          <Outlet />
        </div>
      </main>
      {/* Im Vollbild zeigt der Vollbild-Player die Warteschlange selbst. */}
      {!fullOpen && <QueuePanel />}
      <PlayerBar />
      <FullPlayer />
    </div>
  );
}
