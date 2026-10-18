import ArtistGrid from "../components/ArtistGrid";
import QueryStates from "../components/QueryStates";
import { useArtistIndexes } from "../hooks/library";
import { useT } from "../i18n";

/** Künstlerliste, nach Buchstaben gruppiert, wie `getArtists` sie liefert. */
export default function Artists() {
  const t = useT();
  const indexes = useArtistIndexes();
  const data = indexes.data ?? [];
  const gesamt = data.reduce((sum, index) => sum + index.artist.length, 0);

  return (
    <>
      <h1>{t("nav.artists")}</h1>
      <QueryStates pending={indexes.isPending} error={indexes.error} isEmpty={!gesamt} empty={t("artists.empty")}>
        <nav className="letter-nav" aria-label={t("artists.jump")}>
          {data.map((index, i) => (
            <button key={index.name} type="button" className="ghost" onClick={() => document.getElementById(`buchstabe-${i}`)?.scrollIntoView()}>
              {index.name}
            </button>
          ))}
        </nav>
        {data.map((index, i) => (
          <section key={index.name} id={`buchstabe-${i}`} className="letter-section">
            <h2>{index.name}</h2>
            <ArtistGrid artists={index.artist} />
          </section>
        ))}
      </QueryStates>
    </>
  );
}
