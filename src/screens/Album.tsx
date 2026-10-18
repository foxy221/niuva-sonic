import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../state/session";
import { usePlayer } from "../state/player";
import { formatTime } from "../format";

export default function Album() {
  const { id = "" } = useParams();
  const client = useSession((s) => s.client)!;
  const { queue, index, playing, playQueue } = usePlayer();
  const album = useQuery({ queryKey: ["album", id], queryFn: () => client.getAlbum(id) });
  const songs = album.data?.song ?? [];
  const current = queue[index]?.id;

  if (album.isPending) return <p className="muted">Lade …</p>;
  if (album.isError) return <p className="form-error">{(album.error as Error).message}</p>;

  return (
    <section className="album">
      <Link to="/" className="back">← Zurück</Link>
      <div className="album-head">
        {album.data.coverArt && <img src={client.coverArtUrl(album.data.coverArt, 500)} alt="" />}
        <div>
          <h1>{album.data.name}</h1>
          <p className="muted">{album.data.artist}{album.data.year ? ` · ${album.data.year}` : ""} · {songs.length} Titel</p>
          <button onClick={() => playQueue(songs, 0)} disabled={!songs.length}>Abspielen</button>
        </div>
      </div>
      <ol className="tracklist">
        {songs.map((s, i) => (
          <li key={s.id} className={s.id === current ? "active" : ""}>
            <button className="track" onClick={() => playQueue(songs, i)}>
              <span className="track-no">{s.id === current && playing ? "♪" : s.track ?? i + 1}</span>
              <span className="track-title">{s.title}</span>
              <span className="muted">{formatTime(s.duration ?? 0)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
