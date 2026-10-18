import { useRef, type CSSProperties } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";

/** Lautstärke mit Stummschalten. */
export default function VolumeControl() {
  const t = useT();
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const beforeMute = useRef(0.8);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  function toggleMute() {
    if (volume > 0) {
      beforeMute.current = volume;
      setVolume(0);
    } else setVolume(beforeMute.current);
  }

  return (
    <div className="player-volume">
      <button className="icon" onClick={toggleMute} aria-label={volume === 0 ? t("volume.unmute") : t("volume.mute")}><Icon size={20} /></button>
      <input className="range" type="range" min={0} max={1} step={0.01} value={volume} style={{ "--p": `${volume * 100}%` } as CSSProperties} onChange={(e) => setVolume(Number(e.target.value))} aria-label={t("volume.label")} />
    </div>
  );
}
