import { Link } from "react-router-dom";
import { ListMusic, Maximize2 } from "lucide-react";
import { useUi } from "../design/ui";
import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import SeekBar from "./SeekBar";
import Transport from "./Transport";
import VolumeControl from "./VolumeControl";

export default function PlayerBar() {
  const song = usePlayer((s) => s.queue[s.index]);
  const client = useSession((s) => s.client);
  const { queueOpen, toggleQueue, setFull } = useUi();
  if (!song || !client) return null;

  return (
    <footer className="player">
      <div className="player-track">
        <button className="cover-button" onClick={() => setFull(true)} aria-label="Vollbild-Player öffnen" title="Vollbild-Player">
          {song.coverArt ? <img src={client.coverArtUrl(song.coverArt, 120)} alt="" /> : <div className="cover-empty" />}
          <Maximize2 size={16} />
        </button>
        <div>
          {song.albumId ? <Link to={`/album/${song.albumId}`}><strong>{song.title}</strong></Link> : <strong>{song.title}</strong>}
          {song.artistId ? <Link to={`/artist/${song.artistId}`} className="muted">{song.artist}</Link> : <span className="muted">{song.artist}</span>}
        </div>
      </div>
      <Transport />
      <SeekBar />
      <div className="player-side">
        <button className={`icon${queueOpen ? " on" : ""}`} onClick={toggleQueue} aria-pressed={queueOpen} aria-label="Warteschlange" title="Warteschlange"><ListMusic size={20} /></button>
        <VolumeControl />
      </div>
    </footer>
  );
}
