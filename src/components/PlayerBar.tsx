import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import { formatTime } from "../format";

export default function PlayerBar() {
  const { queue, index, playing, position, duration, volume, toggle, next, prev, seek, setVolume } = usePlayer();
  const client = useSession((s) => s.client);
  const song = queue[index];
  if (!song || !client) return null;

  return (
    <footer className="player">
      <div className="player-track">
        {song.coverArt && <img src={client.coverArtUrl(song.coverArt, 120)} alt="" />}
        <div>
          <strong>{song.title}</strong>
          <span className="muted">{song.artist}</span>
        </div>
      </div>
      <div className="player-center">
        <div className="player-buttons">
          <button className="icon" onClick={prev} aria-label="Zurück">⏮</button>
          <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Wiedergabe"}>{playing ? "⏸" : "▶"}</button>
          <button className="icon" onClick={next} aria-label="Weiter">⏭</button>
        </div>
        <div className="player-seek">
          <span className="muted">{formatTime(position)}</span>
          <input type="range" min={0} max={duration || 0} step={1} value={Math.min(position, duration || 0)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" />
          <span className="muted">{formatTime(duration)}</span>
        </div>
      </div>
      <div className="player-volume">
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Lautstärke" />
      </div>
    </footer>
  );
}
