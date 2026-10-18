import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ListMusic, ListX, X } from "lucide-react";
import { useUi } from "../design/ui";
import { formatTime } from "../format";
import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import { useCoverUrl } from "../hooks/useCoverUrl";
import type { Song } from "../api/types";
import { SortableList, SortableRow } from "./Sortable";

/** Cover einer Zeile: lokal, wenn der Titel offline vorliegt. */
function QueueCover({ song }: { song: Song }) {
  const src = useCoverUrl(song.coverArt, song.albumId, 80);
  return src ? <img src={src} alt="" loading="lazy" /> : <div className="cover-empty" />;
}

/**
 * Warteschlange als Seitenpanel: laufender Titel, was als Nächstes kommt, was schon lief.
 * Springen, Umsortieren, Entfernen und Leeren liegen im Player-Store.
 */
export default function QueuePanel() {
  const { queueOpen, setQueue } = useUi();
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const { jumpTo, moveInQueue, removeFromQueue, clearQueue } = usePlayer.getState();
  const client = useSession((s) => s.client);
  const currentRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (queueOpen) currentRef.current?.scrollIntoView({ block: "center" });
  }, [queueOpen]);

  if (!queueOpen || !client || index < 0) return null;

  const rowBody = (i: number, handle?: ReactNode) => {
    const song = queue[i];
    const current = i === index;
    return (
      <>
        {handle}
        <button type="button" className="queue-jump" onClick={() => jumpTo(i)}>
          <QueueCover song={song} />
          <span className="queue-text">
            <strong>{song.title}</strong>
            <span className="muted">{song.artist}</span>
          </span>
          {current && playing ? <span className="eq" aria-label="Läuft"><i /><i /><i /></span> : <span className="track-time">{formatTime(song.duration ?? 0)}</span>}
        </button>
        <span className="queue-actions">
          <button type="button" className="icon" onClick={() => removeFromQueue(i)} aria-label="Aus der Warteschlange entfernen" title="Entfernen"><X size={16} /></button>
        </span>
      </>
    );
  };

  const plainRow = (i: number) => {
    const current = i === index;
    return (
      <li key={`${queue[i].id}-${i}`} ref={current ? currentRef : undefined} className={`queue-item${current ? " active" : ""}${i < index ? " played" : ""}`}>
        {rowBody(i)}
      </li>
    );
  };

  const upcomingIndexes = queue.slice(index + 1).map((_, k) => index + 1 + k);
  const played = queue.slice(0, index).map((_, i) => plainRow(i));

  return (
    <aside className="queue" aria-label="Warteschlange">
      <header>
        <h2><ListMusic size={20} /> Warteschlange</h2>
        <button className="icon" onClick={clearQueue} aria-label="Warteschlange leeren" title="Warteschlange leeren"><ListX size={20} /></button>
        <button className="icon" onClick={() => setQueue(false)} aria-label="Schließen"><X size={20} /></button>
      </header>
      <div className="queue-scroll">
        <h3>Läuft jetzt</h3>
        <ol>{plainRow(index)}</ol>
        <h3>Als Nächstes</h3>
        {upcomingIndexes.length ? (
          <SortableList indexes={upcomingIndexes} onMove={moveInQueue}>
            <ol>{upcomingIndexes.map((i) => <SortableRow key={i} index={i} className="queue-item">{(handle) => rowBody(i, handle)}</SortableRow>)}</ol>
          </SortableList>
        ) : <p className="muted">Danach ist Schluss. Starte ein Album oder eine Playlist, um die Warteschlange zu füllen.</p>}
        {played.length > 0 && (
          <>
            <h3>Bereits gespielt</h3>
            <ol>{played}</ol>
          </>
        )}
      </div>
    </aside>
  );
}
