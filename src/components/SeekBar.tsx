import type { CSSProperties } from "react";
import { formatTime } from "../format";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";

/** Fortschrittsbalken mit Zeitangaben. */
export default function SeekBar() {
  const t = useT();
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="seek">
      <span className="muted">{formatTime(position)}</span>
      <input className="range" type="range" min={0} max={duration || 0} step={1} value={Math.min(position, duration || 0)} style={{ "--p": `${progress}%` } as CSSProperties} onChange={(e) => seek(Number(e.target.value))} aria-label={t("seek.position")} />
      <span className="muted">{formatTime(duration)}</span>
    </div>
  );
}
