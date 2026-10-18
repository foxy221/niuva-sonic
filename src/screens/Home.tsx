import { useQuery } from "@tanstack/react-query";
import { useSession } from "../state/session";

export default function Home() {
  const { client, creds, logout } = useSession();
  const albums = useQuery({ queryKey: ["albums", "newest"], queryFn: () => client!.getAlbumList("newest", 40) });

  return (
    <div className="home">
      <header className="topbar">
        <img src="/logo.png" alt="Niuva Sonic" />
        <span className="topbar-user">{creds?.username}</span>
        <button className="ghost" onClick={logout}>Abmelden</button>
      </header>
      <h1>Neu hinzugefügt</h1>
      {albums.isPending && <p className="muted">Lade …</p>}
      {albums.isError && <p className="form-error">{(albums.error as Error).message}</p>}
      <ul className="album-grid">
        {albums.data?.map((a) => (
          <li key={a.id}>
            {a.coverArt ? <img src={client!.coverArtUrl(a.coverArt, 400)} alt="" loading="lazy" /> : <div className="cover-empty" />}
            <strong>{a.name}</strong>
            <span className="muted">{a.artist}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
