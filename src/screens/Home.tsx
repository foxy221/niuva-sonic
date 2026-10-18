import AlbumSection from "../components/AlbumSection";
import { useSession } from "../state/session";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Noch wach";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

export default function Home() {
  const name = useSession((s) => s.creds?.username);

  return (
    <>
      <h1 className="home-greeting">{greeting()}, {name}</h1>
      <AlbumSection title="Neu hinzugefügt" type="newest" />
      <AlbumSection title="Zuletzt gespielt" type="recent" empty="Noch nichts gespielt." />
      <AlbumSection title="Meistgespielt" type="frequent" empty="Noch keine Wiedergaben gezählt." />
      <AlbumSection title="Zufällig" type="random" size={12} />
    </>
  );
}
