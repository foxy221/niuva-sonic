import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Play, Save, Trash2 } from "lucide-react";
import PlaylistCover from "../components/PlaylistCover";
import QueryStates from "../components/QueryStates";
import Switch from "../components/Switch";
import SongList from "../components/SongList";
import { formatTime } from "../format";
import { useClient } from "../hooks/useClient";
import { useDeletePlaylist, usePlaylist, useReorderPlaylist, useUpdatePlaylist } from "../hooks/playlists";
import { usePlayer } from "../state/player";
import { moveItem } from "../state/player.logic";

/** Playlist-Detail: abspielen, umbenennen, Titel entfernen, löschen. */
export default function Playlist() {
  const { id = "" } = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const playlist = usePlaylist(id);
  const update = useUpdatePlaylist(id);
  const reorder = useReorderPlaylist(id);
  const remove = useDeletePlaylist();
  const playQueue = usePlayer((s) => s.playQueue);
  const data = playlist.data;
  const songs = data?.entry ?? [];
  const readonly = Boolean(data?.readonly);

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const updateInFlight = useRef(false);
  const editingDisabled = update.isPending || reorder.isPending || remove.isPending || playlist.isFetching;

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
    changePlaylist({ name: name.trim() || data?.name, comment, public: isPublic });
  }

  function changePlaylist(input: Parameters<typeof update.mutate>[0]) {
    // Der Ref sperrt auch zwei Klicks vor dem nächsten React-Render.
    if (readonly || editingDisabled || updateInFlight.current) return;
    updateInFlight.current = true;
    update.mutate(input, { onSettled: () => { updateInFlight.current = false; } });
  }

  /** Titel per Ziehen umsortieren; wie jede Änderung nur, wenn gerade keine andere läuft. */
  function moveSong(from: number, to: number) {
    if (readonly || !data || editingDisabled || updateInFlight.current) return;
    updateInFlight.current = true;
    reorder.mutate({ name: data.name, songs: moveItem(songs, from, to) }, { onSettled: () => { updateInFlight.current = false; } });
  }

  function removeSong(index: number) {
    changePlaylist({ songIndexesToRemove: [index] });
  }

  function deletePlaylist() {
    if (readonly || editingDisabled || updateInFlight.current) return;
    remove.mutate(id, { onSuccess: () => navigate("/playlists") });
  }

  return (
    <section className="album">
      <Link to="/playlists" className="back"><ChevronLeft size={18} /> Playlists</Link>
      <QueryStates pending={playlist.isPending} error={playlist.error} isEmpty={!data} empty="Playlist nicht gefunden.">
        {data && (
          <>
            <div className="album-head">
              <PlaylistCover id={data.id} serverImage={data.coverArt ? client.coverArtUrl(data.coverArt, 500) : undefined} />
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
                <label className="field">
                  Name
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="field">
                  Kommentar
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                <div className="public">
                  <Switch label="Öffentlich" checked={isPublic} onChange={setIsPublic} disabled={editingDisabled} />
                  <span aria-hidden="true">Öffentlich</span>
                </div>
                <button type="submit" disabled={editingDisabled}>
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
                action={readonly ? undefined : { label: "Entfernen", onClick: removeSong, disabled: editingDisabled }}
                onMove={readonly ? undefined : moveSong}
              />
            ) : (
              <p className="muted">Noch keine Titel. Das Playlist-Symbol an einem Titel oder „Album anhängen“ auf einer Album-Seite fügt welche hinzu.</p>
            )}

            {!readonly && (
              <p className="playlist-danger">
                {confirming ? (
                  <>
                    <button type="button" className="ghost" onClick={deletePlaylist} disabled={editingDisabled}>
                      Wirklich löschen
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(true)} disabled={editingDisabled}>
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
