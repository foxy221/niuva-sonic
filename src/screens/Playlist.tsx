import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ListMusic, Play, Save, Trash2 } from "lucide-react";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { formatTime } from "../format";
import { useClient } from "../hooks/useClient";
import { useDeletePlaylist, usePlaylist, useUpdatePlaylist } from "../hooks/playlists";
import { usePlayer } from "../state/player";

/** Playlist-Detail: abspielen, umbenennen, Titel entfernen, löschen. */
export default function Playlist() {
  const { id = "" } = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const playlist = usePlaylist(id);
  const update = useUpdatePlaylist(id);
  const remove = useDeletePlaylist();
  const playQueue = usePlayer((s) => s.playQueue);
  const data = playlist.data;
  const songs = data?.entry ?? [];
  const readonly = Boolean(data?.readonly);

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Felder füllen, sobald die Playlist geladen ist; beim Wechsel der ID neu.
  const loadedId = data?.id;
  useEffect(() => {
    if (!loadedId) return;
    setName(data?.name ?? "");
    setComment(data?.comment ?? "");
    setIsPublic(Boolean(data?.public));
  }, [loadedId]);

  function save(e: FormEvent) {
    e.preventDefault();
    update.mutate({ name: name.trim() || data?.name, comment, public: isPublic });
  }

  function removeSong(index: number) {
    update.mutate({ songIndexesToRemove: [index] });
  }

  function deletePlaylist() {
    remove.mutate(id, { onSuccess: () => navigate("/playlists") });
  }

  return (
    <section className="album">
      <Link to="/playlists" className="back"><ChevronLeft size={18} /> Playlists</Link>
      <QueryStates pending={playlist.isPending} error={playlist.error} isEmpty={!data} empty="Playlist nicht gefunden.">
        {data && (
          <>
            <div className="album-head">
              {data.coverArt ? <img src={client.coverArtUrl(data.coverArt, 500)} alt="" /> : <div className="cover-empty"><ListMusic size={56} /></div>}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">
                  {songs.length} Titel
                  {data.duration ? ` · ${formatTime(data.duration)}` : ""}
                  {data.owner ? ` · ${data.owner}` : ""}
                  {readonly ? " · vom Server erzeugt" : ""}
                </p>
                <p className="song-actions">
                  <button type="button" onClick={() => playQueue(songs, 0)} disabled={!songs.length}>
                    <Play size={20} fill="currentColor" /> Abspielen
                  </button>
                </p>
              </div>
            </div>

            {readonly ? (
              <p className="muted">Diese Playlist wird vom Server verwaltet und lässt sich hier nicht ändern.</p>
            ) : (
              <form className="playlist-edit" onSubmit={save}>
                <label>
                  Name
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Kommentar
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                <label>
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> öffentlich
                </label>
                <button type="submit" disabled={update.isPending}>
                  <Save size={18} /> {update.isPending ? "Speichere …" : "Speichern"}
                </button>
              </form>
            )}
            {update.isError && <p className="form-error">{(update.error as Error).message}</p>}

            {songs.length ? (
              <SongList
                songs={songs}
                onPlay={(i) => playQueue(songs, i)}
                showAlbum
                action={readonly ? undefined : { label: "Entfernen", onClick: removeSong }}
              />
            ) : (
              <p className="muted">Noch keine Titel. Auf einer Album-Seite hängt „Album anhängen“ Titel hier an.</p>
            )}

            {!readonly && (
              <p className="playlist-danger">
                {confirming ? (
                  <>
                    <button type="button" className="ghost" onClick={deletePlaylist} disabled={remove.isPending}>
                      Wirklich löschen
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(true)}>
                    <Trash2 size={18} /> Playlist löschen
                  </button>
                )}
              </p>
            )}
            {remove.isError && <p className="form-error">{(remove.error as Error).message}</p>}
          </>
        )}
      </QueryStates>
    </section>
  );
}
