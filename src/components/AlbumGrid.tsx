import { useQueryClient } from "@tanstack/react-query";
import type { Album } from "../api/types";
import { keys } from "../hooks/keys";
import { useClient } from "../hooks/useClient";
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

  async function play(id: string) {
    const album = await queryClient.fetchQuery({ queryKey: keys.album(id), queryFn: () => client.getAlbum(id) });
    if (album.song?.length) playQueue(album.song, 0);
  }

  return (
    <ul className={`album-grid${row ? " row" : ""}`}>
      {albums.map((album) => (
        <CoverTile
          key={album.id}
          to={`/album/${album.id}`}
          image={album.coverArt ? client.coverArtUrl(album.coverArt, 400) : undefined}
          title={album.name}
          subtitle={showArtist ? album.artist : album.year}
          onPlay={() => play(album.id)}
        />
      ))}
    </ul>
  );
}
