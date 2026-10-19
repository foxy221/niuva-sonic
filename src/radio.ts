import type { InternetRadioStation, Song } from "./api/types";
import { t } from "./i18n";

const PREFIX = "radio:";

/**
 * Ein Sender als Eintrag der Warteschlange. So laufen Sender durch dieselbe
 * Wiedergabe wie Titel; `radioUrl` sagt dem Player, dass es ein Live-Stream
 * ohne Dauer, Cover und Server-Titel ist.
 */
export function stationToSong(station: InternetRadioStation): Song {
  return { id: PREFIX + station.id, title: station.name, artist: t("radio.live"), radioUrl: station.streamUrl };
}

export const isRadio = (song?: Pick<Song, "radioUrl"> | null): boolean => Boolean(song?.radioUrl);
