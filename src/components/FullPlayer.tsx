import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ListMusic } from "lucide-react";
import { useUi } from "../design/ui";
import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import { useCoverUrl } from "../hooks/useCoverUrl";
import FavoriteButton from "./FavoriteButton";
import SeekBar from "./SeekBar";
import Transport from "./Transport";
import Visualizer from "./Visualizer";
import VolumeControl from "./VolumeControl";

/** Vollbild-Player: großes Cover vor dem unscharfen Cover als Hintergrund. Schließt mit Escape. */
export default function FullPlayer() {
  const { fullOpen, setFull, queueOpen, toggleQueue } = useUi();
  const song = usePlayer((s) => s.queue[s.index]);
  const client = useSession((s) => s.client);
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
    <div className="full" role="dialog" aria-label="Vollbild-Player">
      {backdrop && <img className="full-backdrop" src={backdrop} alt="" />}
      <Visualizer anchor={coverRef} />
      <header className="full-top">
        <button className="icon" onClick={close} aria-label="Vollbild schließen"><ChevronDown size={26} /></button>
        <button className={`icon${queueOpen ? " on" : ""}`} onClick={() => { toggleQueue(); close(); }} aria-label="Warteschlange"><ListMusic size={22} /></button>
      </header>
      <div className="full-body">
        {cover ? <img ref={(el) => { coverRef.current = el; }} className="full-cover" src={cover} alt="" /> : <div ref={(el) => { coverRef.current = el; }} className="full-cover cover-empty" />}
        <div className="full-info">
          <div className="full-title">
            <div>
              <h1>{song.title}</h1>
              <p>
                {song.artistId ? <Link to={`/artist/${song.artistId}`} onClick={close}>{song.artist}</Link> : song.artist}
                {song.album && <span className="muted"> · {song.albumId ? <Link to={`/album/${song.albumId}`} onClick={close}>{song.album}</Link> : song.album}</span>}
              </p>
            </div>
            <FavoriteButton starred={Boolean(song.starred)} songId={song.id} label="Titel" />
          </div>
          <SeekBar />
          <Transport size={28} />
          <VolumeControl />
        </div>
      </div>
    </div>
  );
}
