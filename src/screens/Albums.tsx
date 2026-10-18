import { useState } from "react";
import type { AlbumListType } from "../api/types";
import AlbumGrid from "../components/AlbumGrid";
import Pager from "../components/Pager";
import QueryStates from "../components/QueryStates";
import { useAlbumList } from "../hooks/library";
import { useT, type MessageKey } from "../i18n";

const PAGE_SIZE = 40;

const SORTS: { value: AlbumListType; label: MessageKey }[] = [
  { value: "alphabeticalByName", label: "albums.sort.title" },
  { value: "alphabeticalByArtist", label: "albums.sort.artist" },
  { value: "newest", label: "albums.sort.newest" },
  { value: "recent", label: "albums.sort.recent" },
  { value: "frequent", label: "albums.sort.frequent" },
  { value: "random", label: "albums.sort.random" },
  { value: "starred", label: "albums.sort.starred" },
  { value: "byYear", label: "albums.sort.byYear" },
  { value: "byGenre", label: "albums.sort.byGenre" },
];

/** Albumliste mit Sortierung und Seiten (`getAlbumList2` mit `offset`). */
export default function Albums() {
  const t = useT();
  const [type, setType] = useState<AlbumListType>("alphabeticalByName");
  const [page, setPage] = useState(0);
  const [fromYear, setFromYear] = useState(1990);
  const [toYear, setToYear] = useState(new Date().getFullYear());
  const [genre, setGenre] = useState("");

  const filter = type === "byYear" ? { fromYear, toYear } : type === "byGenre" ? { genre } : {};
  const albums = useAlbumList(type, PAGE_SIZE, page * PAGE_SIZE, filter);
  const data = albums.data ?? [];

  function changeType(next: AlbumListType) {
    setType(next);
    setPage(0);
  }

  return (
    <>
      <h1>{t("nav.albums")}</h1>
      <p className="filters">
        <label>
          {t("albums.sortBy")}
          <select value={type} onChange={(e) => changeType(e.target.value as AlbumListType)}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {t(sort.label)}
              </option>
            ))}
          </select>
        </label>
        {type === "byYear" && (
          <>
            <label>
              {t("albums.from")}
              <input
                type="number"
                min={1900}
                max={toYear}
                value={fromYear}
                onChange={(e) => {
                  setFromYear(Number(e.target.value));
                  setPage(0);
                }}
              />
            </label>
            <label>
              {t("albums.to")}
              <input
                type="number"
                min={fromYear}
                max={2100}
                value={toYear}
                onChange={(e) => {
                  setToYear(Number(e.target.value));
                  setPage(0);
                }}
              />
            </label>
          </>
        )}
        {type === "byGenre" && (
          <label>
            {t("albums.genre")}
            <input
              type="text"
              placeholder="Rock"
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setPage(0);
              }}
            />
          </label>
        )}
      </p>

      <QueryStates pending={albums.isPending} error={albums.error} isEmpty={!data.length} empty={t("albums.empty")}>
        <AlbumGrid albums={data} />
      </QueryStates>

      <Pager page={page} hasNext={data.length >= PAGE_SIZE} onPage={setPage} />
    </>
  );
}
