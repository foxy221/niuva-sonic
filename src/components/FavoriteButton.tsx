import { Heart } from "lucide-react";
import { useStar } from "../hooks/favorites";
import { useT } from "../i18n";

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
export default function FavoriteButton({ starred, songId, albumId, artistId, label }: FavoriteButtonProps) {
  const t = useT();
  const star = useStar();

  return (
    <button
      type="button"
      className={`icon fav${starred ? " on" : ""}`}
      aria-pressed={starred}
      aria-label={t(starred ? "favorite.remove" : "favorite.add", { label: label ?? t("favorite.item") })}
      title={starred ? t("favorite.removeTitle") : t("favorite.addTitle")}
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
