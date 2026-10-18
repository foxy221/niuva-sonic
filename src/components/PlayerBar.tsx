import { Link } from "react-router-dom";
import { CircleAlert, ListMusic, LoaderCircle, Maximize2, RefreshCw } from "lucide-react";
import { useUi } from "../design/ui";
import { usePlayer } from "../state/player";
import { useSession } from "../state/session";
import { useCoverUrl } from "../hooks/useCoverUrl";
import { useT } from "../i18n";
import SeekBar from "./SeekBar";
import Transport from "./Transport";
import VolumeControl from "./VolumeControl";

export default function PlayerBar() {
  const t = useT();
  const song = usePlayer((s) => s.queue[s.index]);
  const buffering = usePlayer((s) => s.buffering);
  const error = usePlayer((s) => s.error);
  const retry = usePlayer((s) => s.retry);
  const client = useSession((s) => s.client);
  const { queueOpen, toggleQueue, setFull } = useUi();
  const cover = useCoverUrl(song?.coverArt, song?.albumId, 120);
  if (!song || !client) return null;

  return (
    <footer className="player">
      <div className="player-track">
        <button className="cover-button" onClick={() => setFull(true)} aria-label={t("player.openFull")} title={t("player.full")}>
          {cover ? <img src={cover} alt="" /> : <div className="cover-empty" />}
          <Maximize2 size={16} />
        </button>
        <div>
          {song.albumId ? <Link to={`/album/${song.albumId}`}><strong>{song.title}</strong></Link> : <strong>{song.title}</strong>}
          {song.artistId ? <Link to={`/artist/${song.artistId}`} className="muted">{song.artist}</Link> : <span className="muted">{song.artist}</span>}
        </div>
        {error ? (
          <span className="player-note error" role="alert">
            <CircleAlert size={14} /> {error}
            <button type="button" className="icon" onClick={retry} aria-label={t("player.retry")} title={t("player.retry")}><RefreshCw size={14} /></button>
          </span>
        ) : buffering ? (
          <span className="player-note"><LoaderCircle className="spin" size={14} /> {t("player.buffering")}</span>
        ) : null}
      </div>
      <Transport />
      <SeekBar />
      <div className="player-side">
        <button className={`icon${queueOpen ? " on" : ""}`} onClick={toggleQueue} aria-pressed={queueOpen} aria-label={t("player.queue")} title={t("player.queue")}><ListMusic size={20} /></button>
        <VolumeControl />
      </div>
    </footer>
  );
}
