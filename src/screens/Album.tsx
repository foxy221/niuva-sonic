import { Link, useParams } from "react-router-dom";
import AddToPlaylist from "../components/AddToPlaylist";
import FavoriteButton from "../components/FavoriteButton";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useAlbum } from "../hooks/library";
import { useClient } from "../hooks/useClient";
import { usePlayer } from "../state/player";

export default function Album() {
  const { id = "" } = useParams();
  const client = useClient();
  const album = useAlbum(id);
  const playQueue = usePlayer((s) => s.playQueue);
  const data = album.data;
  const songs = data?.song ?? [];

  return (
    <section className="album">
      <Link to="/albums" className="back">← Alben</Link>
      <QueryStates pending={album.isPending} error={album.error} isEmpty={!data} empty="Album nicht gefunden.">
        {data && (
          <>
            <div className="album-head">
              {data.coverArt ? <img src={client.coverArtUrl(data.coverArt, 500)} alt="" /> : <div className="cover-empty" />}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">
                  {data.artistId ? <Link to={`/artist/${data.artistId}`}>{data.artist}</Link> : data.artist}
                  {data.year ? ` · ${data.year}` : ""} · {songs.length} Titel
                  {data.genre ? ` · ${data.genre}` : ""}
                </p>
                <div className="song-actions">
                  <button onClick={() => playQueue(songs, 0)} disabled={!songs.length}>Abspielen</button>
                  <FavoriteButton starred={Boolean(data.starred)} albumId={data.id} label="Album" />
                </div>
                <AddToPlaylist songIds={songs.map((s) => s.id)} label="Album anhängen" />
              </div>
            </div>
            {songs.length ? (
              <SongList songs={songs} onPlay={(i) => playQueue(songs, i)} numbers="track" />
            ) : (
              <p className="muted">Dieses Album hat keine Titel.</p>
            )}
          </>
        )}
      </QueryStates>
    </section>
  );
}
