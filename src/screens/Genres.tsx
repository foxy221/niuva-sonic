import { Link } from "react-router-dom";
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
            <li key={genre.value}>
              <Link to={`/genre/${encodeURIComponent(genre.value)}`}>
                <div className="cover-empty" />
                <strong>{genre.value}</strong>
                <span className="muted">
                  {genre.songCount ?? 0} Titel · {genre.albumCount ?? 0} Alben
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
