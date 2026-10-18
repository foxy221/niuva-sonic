import { useEffect } from "react";
import { accentFromImage } from "./colors";

function apply(property: "--accent" | "--page-accent", color: string | null, fallback: string) {
  document.documentElement.style.setProperty(property, color ?? fallback);
}

/** Färbt `--accent` (Player, laufender Titel) nach dem Cover. Ohne Cover gilt die Markenfarbe. */
export function useNowPlayingAccent(coverUrl: string | undefined) {
  useEffect(() => {
    let stale = false;
    if (!coverUrl) apply("--accent", null, "#ff3d9a");
    else accentFromImage(coverUrl).then((c) => !stale && apply("--accent", c, "#ff3d9a"));
    return () => {
      stale = true;
    };
  }, [coverUrl]);
}

/** Färbt das Hintergrundglühen der geöffneten Seite (`--page-accent`) nach deren Cover. */
export function usePageAccent(coverUrl: string | undefined) {
  useEffect(() => {
    let stale = false;
    if (coverUrl) accentFromImage(coverUrl).then((c) => !stale && c && apply("--page-accent", c, "var(--accent)"));
    return () => {
      stale = true;
      apply("--page-accent", null, "var(--accent)");
    };
  }, [coverUrl]);
}
