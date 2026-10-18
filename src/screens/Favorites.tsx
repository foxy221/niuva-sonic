import AlbumGrid from "../components/AlbumGrid";
import ArtistGrid from "../components/ArtistGrid";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useStarred } from "../hooks/library";
import { useT } from "../i18n";
import { usePlayer } from "../state/player";

/** Favoriten aus `getStarred2`, getrennt nach Künstlern, Alben und Titeln. */
export default function Favorites() {
  const t = useT();
  const starred = useStarred();
  const playQueue = usePlayer((s) => s.playQueue);
  const artists = starred.data?.artist ?? [];
  const albums = starred.data?.album ?? [];
  const songs = starred.data?.song ?? [];
  const leer = !artists.length && !albums.length && !songs.length;

  return (
    <>
      <h1>{t("nav.favorites")}</h1>
      <QueryStates
        pending={starred.isPending}
        error={starred.error}
        isEmpty={leer}
        empty={t("favorites.empty")}
      >
        {artists.length > 0 && (
          <section>
            <h2>{t("nav.artists")}</h2>
            <ArtistGrid artists={artists} withFavorite />
          </section>
        )}

        {albums.length > 0 && (
          <section>
            <h2>{t("nav.albums")}</h2>
            <AlbumGrid albums={albums} />
          </section>
        )}

        {songs.length > 0 && (
          <section>
            <h2>{t("common.tracks")}</h2>
            <SongList songs={songs} onPlay={(i) => playQueue(songs, i)} showAlbum />
          </section>
        )}
      </QueryStates>
    </>
  );
}
