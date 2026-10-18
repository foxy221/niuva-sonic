import { Link, useParams } from "react-router-dom";
import { ChevronLeft, User } from "lucide-react";
import AlbumGrid from "../components/AlbumGrid";
import ArtistGrid from "../components/ArtistGrid";
import FavoriteButton from "../components/FavoriteButton";
import QueryStates from "../components/QueryStates";
import { usePageAccent } from "../design/useAccent";
import { plainText } from "../format";
import { useArtist, useArtistInfo } from "../hooks/library";
import { useClient } from "../hooks/useClient";

/** Künstlerseite: Diskografie, Biografie und ähnliche Künstler. */
export default function Artist() {
  const { id = "" } = useParams();
  const client = useClient();
  const artist = useArtist(id);
  const info = useArtistInfo(id);
  const data = artist.data;
  const albums = data?.album ?? [];
  const similar = info.data?.similarArtist ?? [];
  const bio = info.data?.biography ? plainText(info.data.biography) : "";
  const bild = data?.artistImageUrl ?? (data?.coverArt ? client.coverArtUrl(data.coverArt, 600) : undefined);
  usePageAccent(data?.coverArt ? client.coverArtUrl(data.coverArt, 64) : undefined);

  return (
    <section>
      <Link to="/artists" className="back"><ChevronLeft size={18} /> Künstler</Link>
      <QueryStates pending={artist.isPending} error={artist.error} isEmpty={!data} empty="Künstler nicht gefunden.">
        {data && (
          <>
            <div className="album-head round">
              {bild ? <img src={bild} alt="" /> : <div className="cover-empty"><User size={56} /></div>}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">{albums.length} Alben</p>
                <FavoriteButton starred={Boolean(data.starred)} artistId={data.id} label="Künstler" />
              </div>
            </div>

            <h2>Alben</h2>
            {albums.length ? <AlbumGrid albums={albums} showArtist={false} /> : <p className="muted">Keine Alben hinterlegt.</p>}

            {info.isError && <p className="form-error">{info.error.message}</p>}
            {bio && (
              <section>
                <h2>Über {data.name}</h2>
                <p className="bio">{bio}</p>
              </section>
            )}

            {similar.length > 0 && (
              <section>
                <h2>Ähnliche Künstler</h2>
                <ArtistGrid artists={similar} />
              </section>
            )}
          </>
        )}
      </QueryStates>
    </section>
  );
}
