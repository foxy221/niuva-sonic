import { useState, type CSSProperties, type PointerEvent } from "react";
import { formatTime } from "../format";
import { useT } from "../i18n";
import { isRadio } from "../radio";
import { usePlayer } from "../state/player";

/** Fortschrittsbalken mit Zeitangaben; beim Überfahren zeigt eine Marke die Zeit am Mauszeiger. */
export default function SeekBar() {
  const t = useT();
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const live = usePlayer((s) => isRadio(s.queue[s.index]));
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  function onMove(e: PointerEvent<HTMLInputElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    setHover({ x, time: (x / rect.width) * duration });
  }

  // Ein Live-Stream hat weder Ende noch Sprungmarken: nur die Laufzeit seit dem Start.
  if (live) {
    return (
      <div className="seek">
        <span className="muted">{formatTime(position)}</span>
        <div className="seek-track"><span className="live-badge">{t("radio.live")}</span></div>
        <span className="muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="seek">
      <span className="muted">{formatTime(position)}</span>
      <div className="seek-track">
        {hover && <span className="seek-preview" style={{ left: hover.x }} aria-hidden="true">{formatTime(hover.time)}</span>}
        <input className="range" type="range" min={0} max={duration || 0} step={1} value={Math.min(position, duration || 0)} style={{ "--p": `${progress}%` } as CSSProperties} onChange={(e) => seek(Number(e.target.value))} onPointerMove={onMove} onPointerLeave={() => setHover(null)} aria-label={t("seek.position")} />
      </div>
      <span className="muted">{formatTime(duration)}</span>
    </div>
  );
}
