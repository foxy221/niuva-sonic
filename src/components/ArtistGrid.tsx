import { User } from "lucide-react";
import type { Artist } from "../api/types";
import { useClient } from "../hooks/useClient";
import { useT } from "../i18n";
import CoverTile from "./CoverTile";
import FavoriteButton from "./FavoriteButton";

interface ArtistGridProps {
  artists: Artist[];
  /** Herz je Kachel anzeigen. */
  withFavorite?: boolean;
}

/** Runde Künstler-Kacheln. */
export default function ArtistGrid({ artists, withFavorite = false }: ArtistGridProps) {
  const t = useT();
  const client = useClient();

  return (
    <ul className="album-grid">
      {artists.map((artist) => (
        <CoverTile
          key={artist.id}
          to={`/artist/${artist.id}`}
          image={artist.coverArt ? client.coverArtUrl(artist.coverArt, 300) : undefined}
          title={artist.name}
          subtitle={t("count.albums", { count: artist.albumCount ?? 0 })}
          round
          fallback={<User size={40} />}
          extra={withFavorite && <FavoriteButton starred={Boolean(artist.starred)} artistId={artist.id} label={t("favorite.artist")} />}
        />
      ))}
    </ul>
  );
}
