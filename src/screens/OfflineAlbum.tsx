import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Disc3, Play, X } from "lucide-react";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { formatBytes } from "../format";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";
import { offlineAlbumSongs, useOffline } from "../state/offline";

/** Albumansicht ganz aus der Offline-Ablage; der Server wird nicht gefragt. */
export default function OfflineAlbum() {
  const t = useT();
  const { id = "" } = useParams();
  const entry = useOffline((s) => s.albums[id]);
  const songMap = useOffline((s) => s.songs);
  const coverSource = useOffline((s) => s.coverSource);
  const removeAlbum = useOffline((s) => s.removeAlbum);
  const playQueue = usePlayer((s) => s.playQueue);
  const album = entry?.album;
  const list = useMemo(() => offlineAlbumSongs(songMap, id), [songMap, id]);
  const size = useMemo(() => Object.values(songMap).filter((e) => e.song.albumId === id).reduce((sum, e) => sum + e.size, 0), [songMap, id]);

  return (
    <section className="album">
      <Link to="/offline" className="back"><ChevronLeft size={18} /> {t("nav.offline")}</Link>
      <QueryStates pending={false} error={null} isEmpty={!album} empty={t("offlineAlbum.gone")}>
        {album && (
          <>
            <div className="album-head">
              {album.coverArt && coverSource(album.coverArt) ? (
                <img src={coverSource(album.coverArt) ?? ""} alt="" />
              ) : (
                <div className="cover-empty"><Disc3 size={56} /></div>
              )}
              <div>
                <h1>{album.name}</h1>
                <p className="muted">
                  {album.artist}
                  {album.year ? ` · ${album.year}` : ""} · {t("count.tracks", { count: list.length })} · {formatBytes(size)} · {t("offlineAlbum.available")}
                </p>
                <div className="song-actions">
                  <button onClick={() => playQueue(list, 0)} disabled={!list.length}><Play size={20} fill="currentColor" /> {t("common.play")}</button>
                  <button className="ghost" onClick={() => void removeAlbum(album.id)}><X size={18} /> {t("album.removeOffline")}</button>
                </div>
              </div>
            </div>
            {list.length ? (
              <SongList
                songs={list}
                onPlay={(i) => playQueue(list, i)}
                numbers="track"
                downloads={false}
              />
            ) : (
              <p className="muted">{t("offlineAlbum.noTracks")}</p>
            )}
          </>
        )}
      </QueryStates>
    </section>
  );
}
