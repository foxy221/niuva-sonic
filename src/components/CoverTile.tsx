import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Music, Play } from "lucide-react";

interface CoverTileProps {
  to: string;
  image?: string;
  title: string;
  subtitle?: ReactNode;
  /** Runde Cover für Künstler. */
  round?: boolean;
  /** Ersatz, wenn es kein Bild gibt. */
  fallback?: ReactNode;
  /** Eigener Bildbereich (z. B. Mosaik); ersetzt `image` und `fallback`. */
  media?: ReactNode;
  /** Zeigt den Abspielen-Knopf beim Überfahren. */
  onPlay?: () => void;
  extra?: ReactNode;
}

/** Cover mit Titel darunter. Gemeinsamer Baustein für Alben, Künstler, Genres und Playlists. */
export default function CoverTile({ to, image, title, subtitle, round, fallback, media, onPlay, extra }: CoverTileProps) {
  return (
    <li>
      <div className={`cover${round ? " round" : ""}`}>
        <Link to={to} className="cover-link" tabIndex={-1} aria-hidden="true">
          {media ?? (image ? <img src={image} alt="" loading="lazy" /> : <div className="cover-empty">{fallback ?? <Music size={36} />}</div>)}
        </Link>
        {onPlay && (
          <button type="button" className="fab" onClick={onPlay} aria-label={`${title} abspielen`}>
            <Play size={20} fill="currentColor" />
          </button>
        )}
      </div>
      <Link to={to} className="tile-text">
        <strong>{title}</strong>
        {subtitle && <span className="muted">{subtitle}</span>}
      </Link>
      {extra && <div className="tile-extra">{extra}</div>}
    </li>
  );
}
