import { Link, useParams } from "react-router-dom";
import { ChevronLeft, User } from "lucide-react";
import AlbumGrid from "../components/AlbumGrid";
import ArtistGrid from "../components/ArtistGrid";
import FavoriteButton from "../components/FavoriteButton";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { usePageAccent } from "../design/useAccent";
import { plainText } from "../format";
import { useArtist, useArtistInfo, useTopSongs } from "../hooks/library";
import { useClient } from "../hooks/useClient";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";

/** Künstlerseite: Diskografie, Biografie und ähnliche Künstler. */
export default function Artist() {
  const t = useT();
  const { id = "" } = useParams();
  const client = useClient();
  const artist = useArtist(id);
  const info = useArtistInfo(id);
  const top = useTopSongs(artist.data?.name ?? "");
  const playQueue = usePlayer((s) => s.playQueue);
  const topSongs = top.data ?? [];
  const data = artist.data;
  const albums = data?.album ?? [];
  const similar = info.data?.similarArtist ?? [];
  const bio = info.data?.biography ? plainText(info.data.biography) : "";
  const bild = data?.artistImageUrl ?? (data?.coverArt ? client.coverArtUrl(data.coverArt, 600) : undefined);
  usePageAccent(data?.coverArt ? client.coverArtUrl(data.coverArt, 64) : undefined);

  return (
    <section>
      <Link to="/artists" className="back"><ChevronLeft size={18} /> {t("nav.artists")}</Link>
      <QueryStates pending={artist.isPending} error={artist.error} isEmpty={!data} empty={t("artist.notFound")}>
        {data && (
          <>
            <div className="album-head round">
              {bild ? <img src={bild} alt="" /> : <div className="cover-empty"><User size={56} /></div>}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">{t("count.albums", { count: albums.length })}</p>
                <FavoriteButton starred={Boolean(data.starred)} artistId={data.id} label={t("favorite.artist")} />
              </div>
            </div>

            {topSongs.length > 0 && (
              <section>
                <h2>{t("artist.topSongs")}</h2>
                <SongList songs={topSongs} onPlay={(i) => playQueue(topSongs, i)} showAlbum />
              </section>
            )}

            <h2>{t("nav.albums")}</h2>
            {albums.length ? <AlbumGrid albums={albums} showArtist={false} /> : <p className="muted">{t("artist.noAlbums")}</p>}

            {info.isError && <p className="form-error">{info.error.message}</p>}
            {bio && (
              <section>
                <h2>{t("artist.about", { name: data.name })}</h2>
                <p className="bio">{bio}</p>
              </section>
            )}

            {similar.length > 0 && (
              <section>
                <h2>{t("artist.similar")}</h2>
                <ArtistGrid artists={similar} />
              </section>
            )}
          </>
        )}
      </QueryStates>
    </section>
  );
}
