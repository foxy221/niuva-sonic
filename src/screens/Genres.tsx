import { Tag } from "lucide-react";
import CoverTile from "../components/CoverTile";
import QueryStates from "../components/QueryStates";
import { useGenres } from "../hooks/library";

/** Genre-Übersicht aus `getGenres`. */
export default function Genres() {
  const genres = useGenres();
  const data = genres.data ?? [];

  return (
    <>
      <h1>Genres</h1>
      <QueryStates pending={genres.isPending} error={genres.error} isEmpty={!data.length} empty="Keine Genres gefunden.">
        <ul className="album-grid">
          {data.map((genre) => (
            <CoverTile
              key={genre.value}
              to={`/genre/${encodeURIComponent(genre.value)}`}
              title={genre.value}
              subtitle={`${genre.songCount ?? 0} Titel · ${genre.albumCount ?? 0} Alben`}
              fallback={<Tag size={36} />}
            />
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
