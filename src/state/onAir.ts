import { create } from "zustand";
import { httpFetch } from "../api/subsonic";
import { watchIcy } from "../icy";
import { usePlayer } from "./player";

/**
 * „Läuft gerade“ des aktuellen Radiosenders aus den ICY-Metadaten.
 * Die Verbindung besteht nur, solange der Sender spielt; Pause oder
 * Senderwechsel beenden sie und leeren die Anzeige.
 */
interface OnAirState {
  /** Quelle, zu der `title` gehört. */
  url: string | null;
  title: string | null;
}

export const useOnAirStore = create<OnAirState>(() => ({ url: null, title: null }));

let controller: AbortController | null = null;
let watching: string | null = null;

function sync() {
  const { queue, index, playing, buffering } = usePlayer.getState();
  const url = queue[index]?.radioUrl;
  const wanted = url && (playing || buffering) ? url : null;
  if (wanted === watching) return;
  controller?.abort();
  controller = null;
  watching = wanted;
  if (url !== useOnAirStore.getState().url) useOnAirStore.setState({ url: url ?? null, title: null });
  if (!wanted) return;
  const mine = (controller = new AbortController());
  void watchIcy(wanted, httpFetch, (title) => {
    // Werbung und Jingles tragen oft nur den Sendernamen: dann nichts doppelt zeigen.
    if (mine.signal.aborted) return;
    useOnAirStore.setState({ url: wanted, title });
    // Auch Sperrbildschirm und Medien-Overlay zeigen den laufenden Titel.
    if ("mediaSession" in navigator && navigator.mediaSession.metadata && title) navigator.mediaSession.metadata.artist = title;
  }, mine.signal);
}

usePlayer.subscribe(sync);

/** Aktueller Titel des laufenden Senders, sonst `null`. */
export function useOnAir(radioUrl: string | undefined): string | null {
  return useOnAirStore((s) => (radioUrl && s.url === radioUrl ? s.title : null));
}
