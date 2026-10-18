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
          <span className="topbar-user">{creds?.username}</span>
          <button className="ghost" onClick={logout}>Abmelden</button>
        </header>
        <Outlet />
      </div>
      <PlayerBar />
    </div>
  );
}
