import { Heart } from "lucide-react";
import { useStar } from "../hooks/favorites";

interface FavoriteButtonProps {
  /** true, wenn das Element bereits ein Favorit ist. */
  starred: boolean;
  songId?: string;
  albumId?: string;
  artistId?: string;
  /** Für die Vorlesehilfe, z. B. „Titel“, „Album“, „Künstler“. */
  label?: string;
}

/** Herz zum Setzen und Entfernen eines Favoriten. */
export default function FavoriteButton({ starred, songId, albumId, artistId, label = "Favorit" }: FavoriteButtonProps) {
  const star = useStar();

  return (
    <button
      type="button"
      className={`icon fav${starred ? " on" : ""}`}
      aria-pressed={starred}
      aria-label={`${label} ${starred ? "aus Favoriten entfernen" : "zu Favoriten hinzufügen"}`}
      title={starred ? "Favorit entfernen" : "Zu Favoriten"}
      disabled={star.isPending}
      onClick={(e) => {
        e.preventDefault();
        star.mutate({
          ids: { id: songId ? [songId] : undefined, albumId: albumId ? [albumId] : undefined, artistId: artistId ? [artistId] : undefined },
          starred,
        });
      }}
    >
      <Heart size={20} />
    </button>
  );
}
