import AlbumSection from "../components/AlbumSection";

export default function Home() {
  return (
    <>
      <h1>Start</h1>
      <AlbumSection title="Neu hinzugefügt" type="newest" />
      <AlbumSection title="Zuletzt gespielt" type="recent" empty="Noch nichts gespielt." />
      <AlbumSection title="Meistgespielt" type="frequent" empty="Noch keine Wiedergaben gezählt." />
      <AlbumSection title="Zufällig" type="random" size={12} />
    </>
  );
}
