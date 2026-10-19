import type { ReactNode } from "react";
import { ArrowDownToLine, CheckCircle2, ListPlus, ListStart, Play, X } from "lucide-react";
import type { Song } from "../api/types";
import { formatTime } from "../format";
import { useT } from "../i18n";
import { isRadio } from "../radio";
import { usePlayer } from "../state/player";
import { offlineSupported, useOffline } from "../state/offline";
import FavoriteButton from "./FavoriteButton";
import SongPlaylistMenu from "./SongPlaylistMenu";
import { SortableList, SortableRow } from "./Sortable";

interface SongListProps {
  songs: Song[];
  /** Startet die Wiedergabe der Liste ab diesem Index. */
  onPlay: (index: number) => void;
  /** Tracknummern aus den Tags oder fortlaufend zählen. */
  numbers?: "track" | "index";
  /** Albumname in der Zeile anzeigen (Genres, Suche, Playlist, Favoriten). */
  showAlbum?: boolean;
  /** Zusätzliche Aktion je Zeile, z. B. „Entfernen“ in einer Playlist. */
  action?: { label: string; onClick: (index: number) => void; disabled?: boolean };
  /** Zeilenaktionen „Als Nächste“ und „Anhängen“ zeigen. */
  queueActions?: boolean;
  /** Menü „Zu Playlist hinzufügen“ je Zeile zeigen. */
  playlistMenu?: boolean;
  /** Aktion „Für offline verfügbar machen“ zeigen; nur in der App. */
  downloads?: boolean;
  /** Macht die Liste per Ziehen umsortierbar; `from` und `to` sind Positionen in `songs`. */
  onMove?: (from: number, to: number) => void;
}

/** Herunterladen oder aus der Offline-Ablage entfernen, je Zeile. */
function SongDownloadAction({ song }: { song: Song }) {
  const t = useT();
  const stored = useOffline((s) => Boolean(s.songs[song.id]));
  const running = useOffline((s) => s.jobs.some((job) => job.state === "running" && job.songIds.includes(song.id)));
  const download = useOffline((s) => s.download);
  const removeSong = useOffline((s) => s.removeSong);
  if (!offlineSupported()) return null;
  if (stored) {
    return (
      <button type="button" className="icon row-action" onClick={() => void removeSong(song.id)} aria-label={t("song.removeOffline")} title={t("song.removeOfflineTitle")}>
        <CheckCircle2 size={18} />
      </button>
    );
  }
  return (
    <button type="button" className="icon row-action" onClick={() => download([song])} disabled={running} aria-label={t("song.makeOffline")} title={t("song.download")}>
      <ArrowDownToLine size={18} />
    </button>
  );
}

/** Titelliste mit Wiedergabe, Herz, Warteschlangen-Aktionen und optionaler Zusatzaktion. */
export default function SongList({ songs, onPlay, numbers = "index", showAlbum = false, action, queueActions = true, playlistMenu = true, downloads = true, onMove }: SongListProps) {
  const t = useT();
  // Nur die Felder abonnieren, die sich auf die Zeilen auswirken; sonst
  // zeichnet die Liste bei jedem Fortschrittswechsel neu.
  const currentId = usePlayer((s) => s.queue[s.index]?.id);
  const playing = usePlayer((s) => s.playing);
  const { playNext, appendToQueue } = usePlayer.getState();

  const rowBody = (song: Song, i: number, isCurrent: boolean, handle?: ReactNode) => (
    <>
      {handle}
      <button type="button" className="track" onClick={() => onPlay(i)}>
        <span className="track-no">
          {isCurrent && playing ? (
            <span className="eq" aria-label={t("queue.playing")}><i /><i /><i /></span>
          ) : (
            <>
              <span className="num">{numbers === "track" ? song.track ?? i + 1 : i + 1}</span>
              <Play className="hover-play" size={16} fill="currentColor" />
            </>
          )}
        </span>
        <span className="track-title">
          {song.title}
          {showAlbum && (song.artist || song.album) && <span className="muted"> · {[song.artist, song.album].filter(Boolean).join(" – ")}</span>}
        </span>
        <span className="track-time">{isRadio(song) ? t("radio.liveShort") : formatTime(song.duration ?? 0)}</span>
      </button>
      <span className="song-actions row-actions">
        {queueActions && (
          <>
            <button type="button" className="icon row-action queue-action" onClick={() => playNext([song])} aria-label={t("song.playNext")} title={t("song.playNextTitle")}><ListStart size={18} /></button>
            <button type="button" className="icon row-action queue-action" onClick={() => appendToQueue([song])} aria-label={t("song.append")} title={t("song.appendTitle")}><ListPlus size={18} /></button>
          </>
        )}
        {!isRadio(song) && <FavoriteButton starred={Boolean(song.starred)} songId={song.id} label={t("favorite.track")} />}
        {playlistMenu && !isRadio(song) && <SongPlaylistMenu songId={song.id} />}
        {downloads && !isRadio(song) && <SongDownloadAction song={song} />}
        {action && (
          <button type="button" className="icon row-action" onClick={() => action.onClick(i)} disabled={action.disabled} aria-label={action.label} title={action.label}>
            <X size={18} />
          </button>
        )}
      </span>
    </>
  );

  const rows = songs.map((song, i) => {
    const isCurrent = song.id === currentId;
    const className = `track-row${isCurrent ? " active" : ""}`;
    if (onMove) return <SortableRow key={i} index={i} className={className}>{(handle) => rowBody(song, i, isCurrent, handle)}</SortableRow>;
    return <li key={`${song.id}-${i}`} className={className}>{rowBody(song, i, isCurrent)}</li>;
  });

  if (!onMove) return <ol className="tracklist">{rows}</ol>;
  return (
    <SortableList indexes={songs.map((_, i) => i)} onMove={onMove}>
      <ol className="tracklist">{rows}</ol>
    </SortableList>
  );
}
