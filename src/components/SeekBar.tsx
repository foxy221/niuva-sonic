import { useState, type CSSProperties, type PointerEvent } from "react";
import { formatTime } from "../format";
import { usePlayer } from "../state/player";

/** Fortschrittsbalken mit Zeitangaben; beim Überfahren zeigt eine Marke die Zeit am Mauszeiger. */
export default function SeekBar() {
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  function onMove(e: PointerEvent<HTMLInputElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    setHover({ x, time: (x / rect.width) * duration });
  }

  return (
    <div className="seek">
      <span className="muted">{formatTime(position)}</span>
      <div className="seek-track">
        {hover && <span className="seek-preview" style={{ left: hover.x }} aria-hidden="true">{formatTime(hover.time)}</span>}
        <input className="range" type="range" min={0} max={duration || 0} step={1} value={Math.min(position, duration || 0)} style={{ "--p": `${progress}%` } as CSSProperties} onChange={(e) => seek(Number(e.target.value))} onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label="Position" />
      </div>
      <span className="muted">{formatTime(duration)}</span>
    </div>
  );
}
