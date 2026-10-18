import AlbumSection from "../components/AlbumSection";
import { useT, type MessageKey } from "../i18n";
import { useSession } from "../state/session";

function greeting(): MessageKey {
  const hour = new Date().getHours();
  if (hour < 5) return "home.greetingNight";
  if (hour < 11) return "home.greetingMorning";
  if (hour < 18) return "home.greetingDay";
  return "home.greetingEvening";
}

export default function Home() {
  const t = useT();
  const name = useSession((s) => s.creds?.username);

  return (
    <>
      <h1 className="home-greeting">{t(greeting())}, {name}</h1>
      <AlbumSection title={t("home.newest")} type="newest" />
      <AlbumSection title={t("home.recent")} type="recent" empty={t("home.recentEmpty")} />
      <AlbumSection title={t("home.frequent")} type="frequent" empty={t("home.frequentEmpty")} />
      <AlbumSection title={t("home.random")} type="random" size={12} />
    </>
  );
}
