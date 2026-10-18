import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "../state/player";

/** Zurück, Abspielen/Pause, Weiter. Gleiche Bedienung in Leiste und Vollbild. */
export default function Transport({ size = 22 }: { size?: number }) {
  const playing = usePlayer((s) => s.playing);
  const { toggle, next, prev } = usePlayer.getState();

  return (
    <div className="player-buttons">
      <button className="icon skip-back" onClick={prev} aria-label="Vorheriger Titel"><SkipBack size={size} fill="currentColor" /></button>
      <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Wiedergabe"}>
        {playing ? <Pause size={size} fill="currentColor" /> : <Play size={size} fill="currentColor" />}
      </button>
      <button className="icon" onClick={next} aria-label="Nächster Titel"><SkipForward size={size} fill="currentColor" /></button>
    </div>
  );
}
