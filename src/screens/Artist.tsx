import { Link, useParams } from "react-router-dom";
import AlbumGrid from "../components/AlbumGrid";
import FavoriteButton from "../components/FavoriteButton";
import QueryStates from "../components/QueryStates";
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

  return (
    <section>
      <Link to="/artists" className="back">← Künstler</Link>
      <QueryStates pending={artist.isPending} error={artist.error} isEmpty={!data} empty="Künstler nicht gefunden.">
        {data && (
          <>
            <div className="album-head">
              {bild ? <img src={bild} alt="" /> : <div className="cover-empty" />}
              <div>
                <h1>{data.name}</h1>
                <p className="muted">{albums.length} Alben</p>
                <FavoriteButton starred={Boolean(data.starred)} artistId={data.id} label="Künstler" />
              </div>
            </div>

            <h2>Alben</h2>
            {albums.length ? <AlbumGrid albums={albums} showArtist={false} /> : <p className="muted">Keine Alben hinterlegt.</p>}

            {info.isPending && <p className="muted">Lade Biografie …</p>}
            {info.isError && <p className="form-error">{info.error.message}</p>}
            {bio && (
              <section>
                <h2>Über {data.name}</h2>
                <p className="muted">{bio}</p>
              </section>
            )}

            {similar.length > 0 && (
              <section>
                <h2>Ähnliche Künstler</h2>
                <ul className="album-grid">
                  {similar.map((a) => (
                    <li key={a.id}>
                      <Link to={`/artist/${a.id}`}>
                        {a.coverArt ? <img src={client.coverArtUrl(a.coverArt, 300)} alt="" loading="lazy" /> : <div className="cover-empty" />}
                        <strong>{a.name}</strong>
                        <span className="muted">{a.albumCount ?? 0} Alben</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </QueryStates>
    </section>
  );
}
