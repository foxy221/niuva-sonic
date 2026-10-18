import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Play } from "lucide-react";
import Pager from "../components/Pager";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useSongsByGenre } from "../hooks/library";
import { usePlayer } from "../state/player";

const PAGE_SIZE = 100;

/** Alle Titel eines Genres (`getSongsByGenre`), seitenweise. */
export default function Genre() {
  const { name: genre = "" } = useParams();
  const [page, setPage] = useState(0);
  const songs = useSongsByGenre(genre, PAGE_SIZE, page * PAGE_SIZE);
  const playQueue = usePlayer((s) => s.playQueue);
  const data = songs.data ?? [];

  return (
    <section>
      <Link to="/genres" className="back"><ChevronLeft size={18} /> Genres</Link>
      <h1>{genre}</h1>
      <p className="song-actions">
        <button type="button" onClick={() => playQueue(data, 0)} disabled={!data.length}>
          <Play size={20} fill="currentColor" /> Abspielen
        </button>
      </p>
      <QueryStates pending={songs.isPending} error={songs.error} isEmpty={!data.length} empty="Keine Titel in diesem Genre.">
        <SongList songs={data} onPlay={(i) => playQueue(data, i)} showAlbum />
      </QueryStates>
      <Pager page={page} hasNext={data.length >= PAGE_SIZE} onPage={setPage} />
    </section>
  );
}
