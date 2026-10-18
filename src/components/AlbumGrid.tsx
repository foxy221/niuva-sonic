import { Link } from "react-router-dom";
import type { Album } from "../api/types";
import { useClient } from "../hooks/useClient";

interface AlbumGridProps {
  albums: Album[];
  /** Album-Titel in der Kachel anzeigen (auf der Künstlerseite unnötig). */
  showArtist?: boolean;
}

/** Cover-Raster für Alben. Nutzt die bestehende Klasse `.album-grid`. */
export default function AlbumGrid({ albums, showArtist = true }: AlbumGridProps) {
  const client = useClient();

  return (
    <ul className="album-grid">
      {albums.map((album) => (
        <li key={album.id}>
          <Link to={`/album/${album.id}`}>
            {album.coverArt ? (
              <img src={client.coverArtUrl(album.coverArt, 400)} alt="" loading="lazy" />
            ) : (
              <div className="cover-empty" />
            )}
            <strong>{album.name}</strong>
            {showArtist && <span className="muted">{album.artist}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
