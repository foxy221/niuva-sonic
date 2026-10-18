import { Tag } from "lucide-react";
import CoverTile from "../components/CoverTile";
import QueryStates from "../components/QueryStates";
import { useGenres } from "../hooks/library";
import { useT } from "../i18n";

/** Genre-Übersicht aus `getGenres`. */
export default function Genres() {
  const t = useT();
  const genres = useGenres();
  const data = genres.data ?? [];

  return (
    <>
      <h1>{t("nav.genres")}</h1>
      <QueryStates pending={genres.isPending} error={genres.error} isEmpty={!data.length} empty={t("genres.empty")}>
        <ul className="album-grid">
          {data.map((genre) => (
            <CoverTile
              key={genre.value}
              to={`/genre/${encodeURIComponent(genre.value)}`}
              title={genre.value}
              subtitle={`${t("count.tracks", { count: genre.songCount ?? 0 })} · ${t("count.albums", { count: genre.albumCount ?? 0 })}`}
              fallback={<Tag size={36} />}
            />
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
