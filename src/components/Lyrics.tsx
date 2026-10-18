import { useEffect, useRef } from "react";
import type { Song } from "../api/types";
import { useLyrics } from "../hooks/library";
import { useT } from "../i18n";
import { activeLineIndex, pickLyrics } from "../lyrics";
import { useCapabilities } from "../state/capabilities";
import { usePlayer } from "../state/player";

/** Songtext im Vollbild-Player; synchrone Texte folgen der Wiedergabe. */
export default function Lyrics({ song }: { song: Song }) {
  const t = useT();
  const supported = useCapabilities((s) => s.supports("songLyrics"));
  const query = useLyrics(song.id, supported);
  const lyrics = query.data ? pickLyrics(query.data) : null;
  // Nur die Zeilennummer abonnieren, sonst zeichnet der Text bei jedem Fortschrittsschritt neu.
  const active = usePlayer((s) => (lyrics ? activeLineIndex(lyrics, s.position) : -1));
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  if (!supported) return <p className="lyrics-state muted">{t("lyrics.unsupported")}</p>;
  if (query.isPending) return <p className="lyrics-state muted">{t("common.loading")}</p>;
  if (query.isError) return <p className="lyrics-state muted">{t("lyrics.failed")}</p>;
  if (!lyrics) return <p className="lyrics-state muted">{t("lyrics.none")}</p>;

  return (
    <div className="lyrics" tabIndex={0} aria-label={t("lyrics.title")}>
      {lyrics.line.map((line, i) => (
        <p key={i} ref={i === active ? activeRef : undefined} className={lyrics.synced && i === active ? "lyric on" : "lyric"} aria-current={i === active ? "true" : undefined}>
          {line.value || " "}
        </p>
      ))}
    </div>
  );
}
