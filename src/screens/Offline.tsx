import { useState } from "react";
import { Disc3, X } from "lucide-react";
import CoverTile from "../components/CoverTile";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { formatBytes } from "../format";
import { usePlayer } from "../state/player";
import { offlineAlbumSongs, useOffline, type DownloadJob } from "../state/offline";
import { useSettings } from "../state/settings";

function jobPercent(job: DownloadJob) {
  if (job.totalBytes > 0) return Math.min(100, (job.receivedBytes / job.totalBytes) * 100);
  return job.totalCount > 0 ? (job.doneCount / job.totalCount) * 100 : 0;
}

function describeJob(job: DownloadJob) {
  if (job.state === "done") return `Fertig${job.failedCount ? `, ${job.failedCount} fehlgeschlagen` : ""}.`;
  if (job.state === "canceled") return "Abgebrochen.";
  if (job.state === "error") return job.error ?? "Fehlgeschlagen.";
  return `${job.doneCount}/${job.totalCount} Titel`;
}

/** Offline-Bibliothek: Downloads, heruntergeladene Alben und Titel, lokale Suche. */
export default function Offline() {
  const ready = useOffline((s) => s.ready);
  const songs = useOffline((s) => s.songs);
  const albums = useOffline((s) => s.albums);
  const jobs = useOffline((s) => s.jobs);
  const usage = useOffline((s) => s.usage);
  const coverSource = useOffline((s) => s.coverSource);
  const cancel = useOffline((s) => s.cancel);
  const removeSong = useOffline((s) => s.removeSong);
  const playQueue = usePlayer((s) => s.playQueue);
  const limitGb = useSettings((s) => s.settings.offlineLimitGb);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matches = (...values: (string | undefined)[]) => !needle || values.some((value) => value?.toLowerCase().includes(needle));

  const albumList = Object.values(albums)
    .filter(({ album }) => matches(album.name, album.artist))
    .sort((a, b) => a.album.name.localeCompare(b.album.name, "de"));
  const albumIds = new Set(albumList.map(({ album }) => album.id));
  const singles = Object.values(songs)
    .filter((entry) => !albums[entry.song.albumId ?? ""])
    .sort((a, b) => b.at - a.at)
    .filter(({ song }) => matches(song.title, song.artist, song.album));
  const singleSongs = singles.map((entry) => entry.song);
  const hiddenBySearch = Object.keys(albums).filter((id) => !albumIds.has(id)).length > 0 && Boolean(needle);

  return (
    <section className="offline">
      <h1>Offline</h1>
      <QueryStates pending={!ready} error={null} isEmpty={false}>
        <p className="muted">
          {formatBytes(usage ?? 0)} belegt{limitGb > 0 ? ` von ${limitGb} GB` : ""}. Heruntergeladene Titel spielen auch ohne Serververbindung.
        </p>

        {jobs.length > 0 && (
          <ul className="download-jobs">
            {[...jobs].reverse().map((job) => (
              <li key={job.id} className={`download-job ${job.state}`}>
                <div className="download-job-text">
                  <strong>{job.label}</strong>
                  <span className="muted">{describeJob(job)}</span>
                </div>
                {job.state === "running" && (
                  <>
                    <span className="progress" aria-hidden="true"><span style={{ width: `${jobPercent(job)}%` }} /></span>
                    <button type="button" className="icon" onClick={() => cancel(job.id)} aria-label="Download abbrechen" title="Abbrechen"><X size={18} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <input
          className="offline-search"
          type="search"
          placeholder="Offline-Bibliothek durchsuchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Offline-Bibliothek durchsuchen"
        />

        <h2>Alben</h2>
        {albumList.length ? (
          <ul className="album-grid">
            {albumList.map(({ album }) => {
              const list = offlineAlbumSongs(songs, album.id);
              return (
                <CoverTile
                  key={album.id}
                  to={`/offline/album/${album.id}`}
                  image={album.coverArt ? coverSource(album.coverArt) ?? undefined : undefined}
                  title={album.name}
                  subtitle={album.artist}
                  fallback={<Disc3 size={36} />}
                  onPlay={list.length ? () => playQueue(list, 0) : undefined}
                />
              );
            })}
          </ul>
        ) : (
          <p className="muted">{hiddenBySearch ? "Kein Album passt zur Suche." : "Noch kein Album heruntergeladen. Öffne ein Album und wähle „Herunterladen“."}</p>
        )}

        <h2>Einzelne Titel</h2>
        {singleSongs.length ? (
          <SongList
            songs={singleSongs}
            onPlay={(i) => playQueue(singleSongs, i)}
            showAlbum
            downloads={false}
            action={{ label: "Aus der Offline-Bibliothek entfernen", onClick: (i) => void removeSong(singleSongs[i].id) }}
          />
        ) : (
          <p className="muted">{needle ? "Kein Titel passt zur Suche." : "Noch keine einzelnen Titel heruntergeladen."}</p>
        )}
      </QueryStates>
    </section>
  );
}
