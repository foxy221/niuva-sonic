import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useSession } from "../state/session";

/** Obere Leiste: Zurück/Vor, Suchfeld und Profil. Auf der Suchseite entfällt das Feld, dort steht es groß im Inhalt. */
export default function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const creds = useSession((s) => s.creds);
  const [term, setTerm] = useState("");
  const onSearchPage = pathname === "/search";

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setTerm("");
  }

  return (
    <div className="topbar">
      <button className="icon" onClick={() => navigate(-1)} aria-label="Zurück"><ChevronLeft size={22} /></button>
      <button className="icon" onClick={() => navigate(1)} aria-label="Vor"><ChevronRight size={22} /></button>
      {!onSearchPage && (
        <form className="topbar-search" role="search" onSubmit={submit}>
          <Search size={18} />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Suchen" aria-label="Suche" />
        </form>
      )}
      <Link to="/settings" className="topbar-profile" title="Einstellungen">
        <span className="avatar" aria-hidden="true">{creds?.username.slice(0, 1)}</span>
        <span className="topbar-name">{creds?.username}</span>
      </Link>
    </div>
  );
}
