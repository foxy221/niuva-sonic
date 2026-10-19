import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Clock3, Lock, Music2, Pause, Play, Save, Server, Trash2, UserRound } from "lucide-react";
import PlaylistCover from "../components/PlaylistCover";
import QueryStates from "../components/QueryStates";
import Switch from "../components/Switch";
import SongList from "../components/SongList";
import { useClient } from "../hooks/useClient";
import { useDeletePlaylist, usePlaylist, useReorderPlaylist, useUpdatePlaylist } from "../hooks/playlists";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";
import { usePlaylistSource } from "../state/playlistSource";
import { moveItem } from "../state/player.logic";

/** „49 min“ oder „1 h 12 min“ statt Uhrzeit-Format. */
function longTime(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${Math.max(minutes, 1)} min`;
}

/** Playlist-Detail: abspielen, umbenennen, Titel entfernen, löschen. */
export default function Playlist() {
  const t = useT();
  const { id = "" } = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const playlist = usePlaylist(id);
  const update = useUpdatePlaylist(id);
  const reorder = useReorderPlaylist(id);
  const remove = useDeletePlaylist();
  const playQueue = usePlayer((s) => s.playQueue);
  const { play, pause } = usePlayer.getState();
  const playing = usePlayer((s) => s.playing);
  const data = playlist.data;
  const songs = data?.entry ?? [];
  // Läuft diese Playlist gerade (oder ist sie pausiert in der Warteschlange), schaltet der Knopf um statt neu zu starten.
  const isQueued = usePlayer((s) => songs.length > 0 && s.queue.length === songs.length && s.queue.every((q, i) => q.id === songs[i].id));
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

  function start(index: number) {
    if (data) usePlaylistSource.getState().mark(data.id, songs);
    playQueue(songs, index);
  }

  function togglePlay() {
    if (!isQueued) start(0);
    else if (playing) pause();
    else play();
  }

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
      <Link to="/playlists" className="back"><ChevronLeft size={18} /> {t("nav.playlists")}</Link>
      <QueryStates pending={playlist.isPending} error={playlist.error} isEmpty={!data} empty={t("playlist.notFound")}>
        {data && (
          <>
            <div className="album-head">
              <PlaylistCover id={data.id} serverImage={data.coverArt ? client.coverArtUrl(data.coverArt, 500) : undefined} />
              <div>
                <h1>{data.name}</h1>
                <ul className="meta-chips">
                  {readonly && <li className="chip-server"><Server size={14} /> {t("playlist.generated")}</li>}
                  <li><Music2 size={15} /> {t("count.tracks", { count: songs.length })}</li>
                  {data.duration ? <li><Clock3 size={15} /> {longTime(data.duration)}</li> : null}
                  {data.owner ? <li><UserRound size={15} /> {data.owner}</li> : null}
                </ul>
                <p className="song-actions">
                  <button type="button" onClick={togglePlay} disabled={!songs.length}>
                    {isQueued && playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />} {isQueued && playing ? t("common.pause") : t("common.play")}
                  </button>
                </p>
              </div>
            </div>

            {readonly ? (
              <p className="readonly-note"><Lock size={16} /> {t("playlist.readonlyNote")}</p>
            ) : (
              <form className="playlist-edit" onSubmit={save}>
                <label className="field">
                  {t("playlist.name")}
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="field">
                  {t("playlist.comment")}
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                <div className="public">
                  <Switch label={t("playlist.public")} checked={isPublic} onChange={setIsPublic} disabled={editingDisabled} />
                  <span aria-hidden="true">{t("playlist.public")}</span>
                </div>
                <button type="submit" disabled={editingDisabled}>
                  <Save size={18} /> {update.isPending ? t("playlist.saving") : t("playlist.save")}
                </button>
              </form>
            )}
            {update.isError && <p className="form-error">{(update.error as Error).message}</p>}

            {songs.length ? (
              <SongList
                songs={songs}
                onPlay={start}
                showAlbum
                action={readonly ? undefined : { label: t("playlist.removeTrack"), onClick: removeSong, disabled: editingDisabled }}
                onMove={readonly ? undefined : moveSong}
              />
            ) : (
              <p className="muted">{t("playlist.noTracks")}</p>
            )}

            {!readonly && (
              <p className="playlist-danger">
                {confirming ? (
                  <>
                    <button type="button" className="ghost" onClick={deletePlaylist} disabled={editingDisabled}>
                      {t("playlist.confirmDelete")}
                    </button>
                    <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                      {t("common.cancel")}
                    </button>
                  </>
                ) : (
                  <button type="button" className="ghost" onClick={() => setConfirming(true)} disabled={editingDisabled}>
                    <Trash2 size={18} /> {t("playlist.delete")}
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
