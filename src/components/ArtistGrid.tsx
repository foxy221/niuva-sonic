import { Link } from "react-router-dom";
import type { Artist } from "../api/types";
import { useClient } from "../hooks/useClient";
import FavoriteButton from "./FavoriteButton";

interface ArtistGridProps {
  artists: Artist[];
  /** Herz je Kachel anzeigen. */
  withFavorite?: boolean;
}

/** Kachelraster für Künstler. Nutzt die bestehende Klasse `.album-grid`. */
export default function ArtistGrid({ artists, withFavorite = false }: ArtistGridProps) {
  const client = useClient();

  return (
    <ul className="album-grid">
      {artists.map((artist) => (
        <li key={artist.id}>
          <Link to={`/artist/${artist.id}`}>
            {artist.coverArt ? (
              <img src={client.coverArtUrl(artist.coverArt, 300)} alt="" loading="lazy" />
            ) : (
              <div className="cover-empty" />
            )}
            <strong>{artist.name}</strong>
            <span className="muted">{artist.albumCount ?? 0} Alben</span>
          </Link>
          {withFavorite && <FavoriteButton starred={Boolean(artist.starred)} artistId={artist.id} label="Künstler" />}
        </li>
      ))}
    </ul>
  );
}
