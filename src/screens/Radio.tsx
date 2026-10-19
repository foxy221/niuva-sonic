import { Play } from "lucide-react";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useRadioStations } from "../hooks/library";
import { useT } from "../i18n";
import { stationToSong } from "../radio";
import { usePlayer } from "../state/player";

/** Radiosender des Servers (`getInternetRadioStations`). Ein Klick startet den Live-Stream. */
export default function Radio() {
  const t = useT();
  const stations = useRadioStations();
  const playQueue = usePlayer((s) => s.playQueue);
  const songs = (stations.data ?? []).map(stationToSong);

  return (
    <>
      <h1>{t("radio.title")}</h1>
      <QueryStates pending={stations.isPending} error={stations.error} isEmpty={!songs.length} empty={t("radio.empty")}>
        <p className="song-actions">
          <button type="button" onClick={() => playQueue(songs, 0)}>
            <Play size={20} fill="currentColor" /> {t("common.play")}
          </button>
        </p>
        <SongList songs={songs} onPlay={(index) => playQueue(songs, index)} queueActions={false} playlistMenu={false} downloads={false} />
      </QueryStates>
    </>
  );
}
