import { useRef } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import { formatTime } from "../format";

export default function PlayerBar() {
  const { queue, index, playing, position, duration, volume, toggle, next, prev, seek, setVolume } = usePlayer();
  const client = useSession((s) => s.client);
  const beforeMute = useRef(0.8);
  const song = queue[index];
  if (!song || !client) return null;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;

  function toggleMute() {
    if (volume > 0) {
      beforeMute.current = volume;
      setVolume(0);
    } else setVolume(beforeMute.current);
  }

  return (
    <footer className="player">
      <div className="player-track">
        {song.coverArt ? <img src={client.coverArtUrl(song.coverArt, 120)} alt="" /> : <div className="cover-empty" />}
        <div>
          {song.albumId ? <Link to={`/album/${song.albumId}`}><strong>{song.title}</strong></Link> : <strong>{song.title}</strong>}
          {song.artistId ? <Link to={`/artist/${song.artistId}`} className="muted">{song.artist}</Link> : <span className="muted">{song.artist}</span>}
        </div>
      </div>
      <div className="player-buttons">
        <button className="icon skip-back" onClick={prev} aria-label="Vorheriger Titel"><SkipBack size={22} fill="currentColor" /></button>
        <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Wiedergabe"}>
          {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button className="icon" onClick={next} aria-label="Nächster Titel"><SkipForward size={22} fill="currentColor" /></button>
      </div>
      <div className="seek">
        <span className="muted">{formatTime(position)}</span>
        <input className="range" type="range" min={0} max={duration || 0} step={1} value={Math.min(position, duration || 0)} style={{ "--p": `${progress}%` } as React.CSSProperties} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" />
        <span className="muted">{formatTime(duration)}</span>
      </div>
      <div className="player-volume">
        <button className="icon" onClick={toggleMute} aria-label={volume === 0 ? "Ton an" : "Stumm"}><VolumeIcon size={20} /></button>
        <input className="range" type="range" min={0} max={1} step={0.01} value={volume} style={{ "--p": `${volume * 100}%` } as React.CSSProperties} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Lautstärke" />
      </div>
    </footer>
  );
}
