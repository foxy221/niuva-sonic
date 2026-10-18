import { useState } from "react";
import type { AlbumListType } from "../api/types";
import AlbumGrid from "../components/AlbumGrid";
import Pager from "../components/Pager";
import QueryStates from "../components/QueryStates";
import { useAlbumList } from "../hooks/library";

const PAGE_SIZE = 40;

const SORTS: { value: AlbumListType; label: string }[] = [
  { value: "alphabeticalByName", label: "Titel A–Z" },
  { value: "alphabeticalByArtist", label: "Künstler A–Z" },
  { value: "newest", label: "Neu hinzugefügt" },
  { value: "recent", label: "Zuletzt gespielt" },
  { value: "frequent", label: "Meistgespielt" },
  { value: "random", label: "Zufällig" },
  { value: "starred", label: "Favoriten" },
  { value: "byYear", label: "Nach Jahr" },
  { value: "byGenre", label: "Nach Genre" },
];

/** Albumliste mit Sortierung und Seiten (`getAlbumList2` mit `offset`). */
export default function Albums() {
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
      <h1>Alben</h1>
      <p className="filters">
        <label className="muted">
          Sortierung
          <select value={type} onChange={(e) => changeType(e.target.value as AlbumListType)}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
        {type === "byYear" && (
          <>
            <label className="muted">
              Von
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
            <label className="muted">
              Bis
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
          <label className="muted">
            Genre
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

      <QueryStates pending={albums.isPending} error={albums.error} isEmpty={!data.length} empty="Keine Alben in dieser Auswahl.">
        <AlbumGrid albums={data} />
      </QueryStates>

      <Pager page={page} hasNext={data.length >= PAGE_SIZE} onPage={setPage} />
    </>
  );
}
