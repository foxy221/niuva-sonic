import { ListPlus, ListStart, Play, X } from "lucide-react";
import type { Song } from "../api/types";
import { formatTime } from "../format";
import { usePlayer } from "../state/player";
import FavoriteButton from "./FavoriteButton";

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
  /** Zeilenaktionen „Als Nächstes“ und „Anhängen“ zeigen. */
  queueActions?: boolean;
}

/** Titelliste mit Wiedergabe, Herz, Warteschlangen-Aktionen und optionaler Zusatzaktion. */
export default function SongList({ songs, onPlay, numbers = "index", showAlbum = false, action, queueActions = true }: SongListProps) {
  // Nur die Felder abonnieren, die sich auf die Zeilen auswirken; sonst
  // zeichnet die Liste bei jedem Fortschrittswechsel neu.
  const currentId = usePlayer((s) => s.queue[s.index]?.id);
  const playing = usePlayer((s) => s.playing);
  const { playNext, appendToQueue } = usePlayer.getState();

  return (
    <ol className="tracklist">
      {songs.map((song, i) => {
        const isCurrent = song.id === currentId;
        return (
          <li key={`${song.id}-${i}`} className={`track-row${isCurrent ? " active" : ""}`}>
            <button type="button" className="track" onClick={() => onPlay(i)}>
              <span className="track-no">
                {isCurrent && playing ? (
                  <span className="eq" aria-label="Läuft"><i /><i /><i /></span>
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
              <span className="track-time">{formatTime(song.duration ?? 0)}</span>
            </button>
            <span className="song-actions row-actions">
              {queueActions && (
                <>
                  <button type="button" className="icon row-action" onClick={() => playNext([song])} aria-label="Als Nächstes abspielen" title="Als Nächstes"><ListStart size={18} /></button>
                  <button type="button" className="icon row-action" onClick={() => appendToQueue([song])} aria-label="An die Warteschlange anhängen" title="Anhängen"><ListPlus size={18} /></button>
                </>
              )}
              <FavoriteButton starred={Boolean(song.starred)} songId={song.id} label="Titel" />
              {action && (
                <button type="button" className="icon row-action" onClick={() => action.onClick(i)} disabled={action.disabled} aria-label={action.label} title={action.label}>
                  <X size={18} />
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
