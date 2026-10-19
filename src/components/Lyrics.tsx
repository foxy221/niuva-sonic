import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { Song } from "../api/types";
import { useLyrics } from "../hooks/library";
import { useT } from "../i18n";
import { activeLineIndex, pickLyrics } from "../lyrics";
import { useCapabilities } from "../state/capabilities";
import { usePlayer } from "../state/player";

/**
 * Songtext im Vollbild-Player. Synchrone Texte stehen frei auf dem Hintergrund:
 * Die gesungene Zeile füllt sich über ihre Dauer, entferntere Zeilen werden kleiner und unschärfer,
 * Pausen ohne Text zeigen drei atmende Punkte. Ein Klick auf eine Zeile springt dorthin.
 */
export default function Lyrics({ song }: { song: Song }) {
  const t = useT();
  const supported = useCapabilities((s) => s.supports("songLyrics"));
  const query = useLyrics(song.id, supported);
  const lyrics = query.data ? pickLyrics(query.data) : null;
  // Nur die Zeilennummer abonnieren, sonst zeichnet der Text bei jedem Fortschrittsschritt neu.
  const active = usePlayer((s) => (lyrics ? activeLineIndex(lyrics, s.position) : -1));
  const playing = usePlayer((s) => s.playing);
  const seek = usePlayer((s) => s.seek);
  const activeRef = useRef<HTMLElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  // Ändert sich die Breite (Warteschlange, Fenstergröße), bricht der Text neu um: sofort neu zentrieren, sonst springt er.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => activeRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" }));
    observer.observe(box);
    return () => observer.disconnect();
  }, [lyrics]);

  if (!supported) return <p className="lyrics-state muted">{t("lyrics.unsupported")}</p>;
  if (query.isPending) return <p className="lyrics-state muted">{t("common.loading")}</p>;
  if (query.isError) return <p className="lyrics-state muted">{t("lyrics.failed")}</p>;
  if (!lyrics) return <p className="lyrics-state muted">{t("lyrics.none")}</p>;

  const offset = lyrics.offset ?? 0;
  // Wo im Takt die aktive Zeile gerade steht, damit der Verlauf nach einem Sprung nicht bei null beginnt.
  const elapsed = lyrics.synced && active >= 0 ? Math.max(0, usePlayer.getState().position * 1000 - offset - (lyrics.line[active].start ?? 0)) : 0;

  return (
    <div ref={boxRef} className={`lyrics${lyrics.synced ? " synced" : ""}${playing ? "" : " paused"}`} tabIndex={0} aria-label={t("lyrics.title")}>
      {lyrics.line.map((line, i) => {
        const text = line.value.trim();
        const isActive = lyrics.synced && i === active;
        const start = line.start;
        const next = lyrics.line.slice(i + 1).find((l) => typeof l.start === "number")?.start;
        const style: CSSProperties = lyrics.synced
          ? ({ "--d": Math.min(Math.abs(i - active), 6), "--dur": `${Math.max(((next ?? (start ?? 0) + 4000) - (start ?? 0)) / 1000, .4)}s`, "--at": `${-elapsed / 1000}s` } as CSSProperties)
          : {};
        const cls = `lyric${isActive ? " on" : ""}${lyrics.synced && i < active ? " past" : ""}${text ? "" : " gap"}`;
        const ref = i === active ? (el: HTMLElement | null) => { activeRef.current = el; } : undefined;
        if (!text) {
          return <div key={i} ref={ref} className={cls} style={style} aria-hidden="true"><span /><span /><span /></div>;
        }
        if (lyrics.synced && typeof start === "number") {
          return (
            <button key={i} ref={ref} className={cls} style={style} aria-current={isActive ? "true" : undefined} onClick={() => seek((start + offset) / 1000)}>
              <span>{text}</span>
            </button>
          );
        }
        return <p key={i} className={cls}>{text}</p>;
      })}
    </div>
  );
}
