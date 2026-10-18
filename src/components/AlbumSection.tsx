import type { AlbumListType } from "../api/types";
import { useAlbumList } from "../hooks/library";
import type { AlbumListFilter } from "../hooks/keys";
import AlbumGrid from "./AlbumGrid";
import QueryStates from "./QueryStates";

interface AlbumSectionProps {
  title: string;
  type: AlbumListType;
  size?: number;
  filter?: AlbumListFilter;
  empty?: string;
}

/** Eine Reihe der Startseite mit eigener Abfrage und eigenem Zustand. */
export default function AlbumSection({ title, type, size = 20, filter, empty }: AlbumSectionProps) {
  const albums = useAlbumList(type, size, 0, filter);
  const data = albums.data ?? [];

  return (
    <section>
      <h2>{title}</h2>
      <QueryStates pending={albums.isPending} error={albums.error} isEmpty={!data.length} empty={empty}>
        <AlbumGrid albums={data} row />
      </QueryStates>
    </section>
  );
}
