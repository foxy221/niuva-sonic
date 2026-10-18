import AlbumGrid from "../components/AlbumGrid";
import ArtistGrid from "../components/ArtistGrid";
import QueryStates from "../components/QueryStates";
import SongList from "../components/SongList";
import { useStarred } from "../hooks/library";
import { usePlayer } from "../state/player";

/** Favoriten aus `getStarred2`, getrennt nach Künstlern, Alben und Titeln. */
export default function Favorites() {
  const starred = useStarred();
  const playQueue = usePlayer((s) => s.playQueue);
  const artists = starred.data?.artist ?? [];
  const albums = starred.data?.album ?? [];
  const songs = starred.data?.song ?? [];
  const leer = !artists.length && !albums.length && !songs.length;

  return (
    <>
      <h1>Favoriten</h1>
      <QueryStates
        pending={starred.isPending}
        error={starred.error}
        isEmpty={leer}
        empty="Noch keine Favoriten. Setze das Herz bei einem Titel, Album oder Künstler."
      >
        {artists.length > 0 && (
          <section>
            <h2>Künstler</h2>
            <ArtistGrid artists={artists} withFavorite />
          </section>
        )}

        {albums.length > 0 && (
          <section>
            <h2>Alben</h2>
            <AlbumGrid albums={albums} />
          </section>
        )}

        {songs.length > 0 && (
          <section>
            <h2>Titel</h2>
            <SongList songs={songs} onPlay={(i) => playQueue(songs, i)} showAlbum />
          </section>
        )}
      </QueryStates>
    </>
  );
}
