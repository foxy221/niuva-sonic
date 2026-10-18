import { Search as SearchIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import AlbumGrid from "../components/AlbumGrid";
import ArtistGrid from "../components/ArtistGrid";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useSearch } from "../hooks/library";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { usePlayer } from "../state/player";

/** Suche über `search3`, entprellt, getrennt nach Künstlern, Alben und Titeln. */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const term = params.get("q") ?? "";
  const setTerm = (value: string) => setParams(value ? { q: value } : {}, { replace: true });
  const debounced = useDebouncedValue(term, 300);
  const results = useSearch(debounced);
  const playQueue = usePlayer((s) => s.playQueue);
  const artists = results.data?.artist ?? [];
  const albums = results.data?.album ?? [];
  const songs = results.data?.song ?? [];
  const suchbegriff = debounced.trim();
  const leer = !artists.length && !albums.length && !songs.length;

  return (
    <>
      <h1>Suche</h1>
      <form className="search-field" role="search" onSubmit={(e) => e.preventDefault()}>
        <SearchIcon size={20} />
        <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Künstler, Album oder Titel" aria-label="Suchbegriff" autoFocus />
      </form>

      {suchbegriff.length < 2 ? (
        <p className="muted">Mindestens zwei Zeichen eingeben.</p>
      ) : (
        <QueryStates pending={results.isPending} error={results.error} isEmpty={leer} empty={`Keine Treffer für „${suchbegriff}“.`}>
          {artists.length > 0 && (
            <section>
              <h2>Künstler</h2>
              <ArtistGrid artists={artists} withFavorite />
            </section>
          )}
          {albums.length > 0 && (
            <section>
              <h2>Alben</h2>
              <AlbumGrid albums={albums} />
            </section>
          )}
          {songs.length > 0 && (
            <section>
              <h2>Titel</h2>
              <SongList songs={songs} onPlay={(i) => playQueue(songs, i)} showAlbum />
            </section>
          )}
        </QueryStates>
      )}
    </>
  );
}
