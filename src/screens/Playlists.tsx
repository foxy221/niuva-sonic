import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import QueryStates from "../components/QueryStates";
import { formatTime } from "../format";
import { useClient } from "../hooks/useClient";
import { useCreatePlaylist, usePlaylists } from "../hooks/playlists";

/** Playlist-Übersicht mit Anlegen (`getPlaylists`, `createPlaylist`). */
export default function Playlists() {
  const client = useClient();
  const playlists = usePlaylists();
  const create = useCreatePlaylist();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const data = playlists.data ?? [];

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
      onSuccess: (playlist) => {
        setName("");
        if (playlist) navigate(`/playlist/${playlist.id}`);
      },
    });
  }

  return (
    <>
      <h1>Playlists</h1>
      <form className="filters" onSubmit={submit}>
        <label className="muted">
          Neue Playlist
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Lege an …" : "Anlegen"}
        </button>
      </form>
      {create.isError && <p className="form-error">{(create.error as Error).message}</p>}

      <QueryStates pending={playlists.isPending} error={playlists.error} isEmpty={!data.length} empty="Keine Playlists vorhanden.">
        <ul className="album-grid">
          {data.map((playlist) => (
            <li key={playlist.id}>
              <Link to={`/playlist/${playlist.id}`}>
                {playlist.coverArt ? <img src={client.coverArtUrl(playlist.coverArt, 400)} alt="" loading="lazy" /> : <div className="cover-empty" />}
                <strong>{playlist.name}</strong>
                <span className="muted">
                  {playlist.songCount ?? 0} Titel
                  {playlist.duration ? ` · ${formatTime(playlist.duration)}` : ""}
                  {playlist.owner ? ` · ${playlist.owner}` : ""}
                </span>
                {playlist.readonly && <span className="muted">Vom Server erzeugt</span>}
              </Link>
            </li>
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
