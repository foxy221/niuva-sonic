import { Link, useParams } from "react-router-dom";
import { ArrowDownToLine, ChevronLeft, Disc3, Play, X } from "lucide-react";
import AddToPlaylist from "../components/AddToPlaylist";
import FavoriteButton from "../components/FavoriteButton";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { usePageAccent } from "../design/useAccent";
import { useAlbum } from "../hooks/library";
import { useClient } from "../hooks/useClient";
import { usePlayer } from "../state/player";
import { offlineSupported, useOffline } from "../state/offline";

export default function Album() {
  const { id = "" } = useParams();
  const client = useClient();
  const album = useAlbum(id);
  const playQueue = usePlayer((s) => s.playQueue);
  const storedAlbum = useOffline((s) => (id ? s.albums[id] : undefined));
  const job = useOffline((s) => s.jobs.find((j) => j.albumId === id && j.state === "running"));
  const download = useOffline((s) => s.download);
  const removeAlbum = useOffline((s) => s.removeAlbum);
  const data = album.data;
  const songs = data?.song ?? [];
  usePageAccent(data?.coverArt ? client.coverArtUrl(data.coverArt, 64) : undefined);

  return (
    <section className="album">
      <Link to="/albums" className="back"><ChevronLeft size={18} /> Alben</Link>
      <QueryStates pending={album.isPending} error={album.error} isEmpty={!data} empty="Album nicht gefunden.">
        {data && (
          <>
            <div className="album-head">
              {data.coverArt ? <img src={client.coverArtUrl(data.coverArt, 500)} alt="" /> : <div className="cover-empty"><Disc3 size={56} /></div>}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">
                  {data.artistId ? <Link to={`/artist/${data.artistId}`}>{data.artist}</Link> : data.artist}
                  {data.year ? ` · ${data.year}` : ""} · {songs.length} Titel
                  {data.genre ? ` · ${data.genre}` : ""}
                </p>
                <div className="song-actions">
                  <button onClick={() => playQueue(songs, 0)} disabled={!songs.length}><Play size={20} fill="currentColor" /> Abspielen</button>
                  <FavoriteButton starred={Boolean(data.starred)} albumId={data.id} label="Album" />
                  {offlineSupported() && !job && (
                    storedAlbum ? (
                      <button className="ghost" onClick={() => void removeAlbum(data.id)}><X size={18} /> Offline entfernen</button>
                    ) : (
                      <button onClick={() => download(songs, data)} disabled={!songs.length}><ArrowDownToLine size={18} /> Herunterladen</button>
                    )
                  )}
                  {job && <span className="muted">Wird geladen … {job.doneCount}/{job.totalCount}</span>}
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
