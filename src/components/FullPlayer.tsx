import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ListMusic, MicVocal } from "lucide-react";
import { useUi } from "../design/ui";
import { usePlayer } from "../state/player";
import { useCapabilities } from "../state/capabilities";
import { useSession } from "../state/session";
import { useCoverUrl } from "../hooks/useCoverUrl";
import { useT } from "../i18n";
import FavoriteButton from "./FavoriteButton";
import Lyrics from "./Lyrics";
import QueuePanel from "./QueuePanel";
import SeekBar from "./SeekBar";
import Transport from "./Transport";
import Visualizer from "./Visualizer";
import VolumeControl from "./VolumeControl";

/** Vollbild-Player: großes Cover vor dem unscharfen Cover als Hintergrund. Schließt mit Escape. */
export default function FullPlayer() {
  const t = useT();
  const { fullOpen, setFull, queueOpen, toggleQueue } = useUi();
  const song = usePlayer((s) => s.queue[s.index]);
  const client = useSession((s) => s.client);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const lyricsSupported = useCapabilities((s) => s.supports("songLyrics"));
  const coverRef = useRef<HTMLElement | null>(null);
  const backdrop = useCoverUrl(song?.coverArt, song?.albumId, 64);
  const cover = useCoverUrl(song?.coverArt, song?.albumId, 800);

  useEffect(() => {
    if (!fullOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullOpen, setFull]);

  if (!fullOpen || !song || !client) return null;
  const close = () => setFull(false);

  return (
    <div className={`full${queueOpen ? " queue-open" : ""}`} role="dialog" aria-label={t("player.full")}>
      {backdrop && <img className="full-backdrop" src={backdrop} alt="" />}
      <Visualizer anchor={coverRef} coverUrl={backdrop} />
      <header className="full-top">
        <button className="icon" onClick={close} aria-label={t("player.closeFull")}><ChevronDown size={26} /></button>
        <div className="full-top-actions">
          {lyricsSupported && <button className={`icon${lyricsOpen ? " on" : ""}`} onClick={() => setLyricsOpen((v) => !v)} aria-label={t("lyrics.title")} aria-pressed={lyricsOpen}><MicVocal size={22} /></button>}
          <button className={`icon${queueOpen ? " on" : ""}`} onClick={toggleQueue} aria-label={t("player.queue")} aria-pressed={queueOpen}><ListMusic size={22} /></button>
        </div>
      </header>
      <div className="full-body">
        <div className="full-left">
          {cover ? <img ref={(el) => { coverRef.current = el; }} className="full-cover" src={cover} alt="" /> : <div ref={(el) => { coverRef.current = el; }} className="full-cover cover-empty" />}
          {lyricsOpen && <div className="full-lyrics"><Lyrics song={song} /></div>}
        </div>
        <div className="full-info">
          <div className="full-title">
            <div>
              <h1>{song.title}</h1>
              <p>
                {song.artistId ? <Link to={`/artist/${song.artistId}`} onClick={close}>{song.artist}</Link> : song.artist}
                {song.album && <span className="muted"> · {song.albumId ? <Link to={`/album/${song.albumId}`} onClick={close}>{song.album}</Link> : song.album}</span>}
              </p>
            </div>
            <FavoriteButton starred={Boolean(song.starred)} songId={song.id} label={t("favorite.track")} />
          </div>
          <SeekBar />
          <Transport size={28} />
          <VolumeControl />
        </div>
      </div>
      <QueuePanel />
    </div>
  );
}
