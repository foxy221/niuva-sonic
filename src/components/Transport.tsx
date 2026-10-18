import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { usePlayer } from "../state/player";

/** Zufall, Zurück, Abspielen/Pause, Weiter, Wiederholen. Gleiche Bedienung in Leiste und Vollbild. */
export default function Transport({ size = 22 }: { size?: number }) {
  const playing = usePlayer((s) => s.playing);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { toggle, next, prev, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const RepeatIcon = repeat === "track" ? Repeat1 : Repeat;
  const repeatLabel = repeat === "off" ? "Wiederholen aus" : repeat === "queue" ? "Warteschlange wiederholen" : "Titel wiederholen";

  return (
    <div className="player-buttons">
      <button className={`icon${shuffle ? " on" : ""}`} onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Zufällige Reihenfolge" title="Zufällige Reihenfolge">
        <Shuffle size={size - 4} />
      </button>
      <button className="icon skip-back" onClick={prev} aria-label="Vorheriger Titel"><SkipBack size={size} fill="currentColor" /></button>
      <button className="play" onClick={toggle} aria-label={playing ? "Pause" : "Wiedergabe"}>
        {playing ? <Pause size={size} fill="currentColor" /> : <Play size={size} fill="currentColor" />}
      </button>
      <button className="icon" onClick={next} aria-label="Nächster Titel"><SkipForward size={size} fill="currentColor" /></button>
      <button className={`icon${repeat !== "off" ? " on" : ""}`} onClick={cycleRepeat} aria-label={repeatLabel} title={repeatLabel}>
        <RepeatIcon size={size - 4} />
      </button>
    </div>
  );
}
