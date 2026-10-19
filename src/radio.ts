import type { InternetRadioStation, Song } from "./api/types";
import { t } from "./i18n";

const PREFIX = "radio:";

/**
 * Ein Sender als Eintrag der Warteschlange. So laufen Sender durch dieselbe
 * Wiedergabe wie Titel; `radioUrl` sagt dem Player, dass es ein Live-Stream
 * ohne Dauer, Cover und Server-Titel ist.
 */
export function stationToSong(station: InternetRadioStation): Song {
  return { id: PREFIX + station.id, title: station.name, artist: t("radio.live"), radioUrl: station.streamUrl, coverArt: station.coverArt || undefined, radioHome: station.homePageUrl || undefined };
}

/** Webseite im Standardbrowser öffnen; nur http(s), alles andere ignorieren. */
export async function openHomePage(url: string) {
  if (!/^https?:\/\//i.test(url)) return;
  if ("__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else window.open(url, "_blank", "noopener");
}

export const isRadio = (song?: Pick<Song, "radioUrl"> | null): boolean => Boolean(song?.radioUrl);
