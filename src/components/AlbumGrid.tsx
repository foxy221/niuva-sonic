import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Album } from "../api/types";
import { keys } from "../hooks/keys";
import { useClient } from "../hooks/useClient";
import { useRowScroll } from "../hooks/useRowScroll";
import { usePlayer } from "../state/player";
import CoverTile from "./CoverTile";

interface AlbumGridProps {
  albums: Album[];
  /** Künstlername unter dem Titel (auf der Künstlerseite unnötig). */
  showArtist?: boolean;
  /** Eine Zeile zum seitlichen Wischen statt eines Rasters. */
  row?: boolean;
}

/** Cover-Raster für Alben; der Abspielen-Knopf lädt die Titel erst beim Klick. */
export default function AlbumGrid({ albums, showArtist = true, row = false }: AlbumGridProps) {
  const client = useClient();
  const queryClient = useQueryClient();
  const playQueue = usePlayer((s) => s.playQueue);
  const scroller = useRowScroll<HTMLUListElement>(albums.length);

  async function play(id: string) {
    const album = await queryClient.fetchQuery({ queryKey: keys.album(id), queryFn: () => client.getAlbum(id) });
    if (album.song?.length) playQueue(album.song, 0);
  }

  const tiles = albums.map((album) => (
    <CoverTile
      key={album.id}
      to={`/album/${album.id}`}
      image={album.coverArt ? client.coverArtUrl(album.coverArt, 400) : undefined}
      title={album.name}
      subtitle={showArtist ? album.artist : album.year}
      onPlay={() => play(album.id)}
    />
  ));

  if (!row) return <ul className="album-grid">{tiles}</ul>;

  // Reihe: mit der Maus ziehbar, Pfeile nur in die Richtung, in die noch Platz ist.
  return (
    <div className="row-wrap">
      <ul ref={scroller.ref} className={`album-grid row${scroller.dragging ? " dragging" : ""}`} {...scroller.handlers}>
        {tiles}
      </ul>
      {scroller.canScrollLeft && (
        <button type="button" className="row-arrow left" onClick={() => scroller.scrollBySteps(-1)} aria-label="Nach links blättern" title="Nach links">
          <ChevronLeft size={22} />
        </button>
      )}
      {scroller.canScrollRight && (
        <button type="button" className="row-arrow right" onClick={() => scroller.scrollBySteps(1)} aria-label="Nach rechts blättern" title="Nach rechts">
          <ChevronRight size={22} />
        </button>
      )}
    </div>
  );
}
