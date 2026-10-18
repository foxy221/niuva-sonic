import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ListMusic, Plus } from "lucide-react";
import CoverTile from "../components/CoverTile";
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
        <label>
          <span className="sr-only">Name der neuen Playlist</span>
          <input type="text" placeholder="Neue Playlist" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" disabled={!name.trim() || create.isPending}>
          <Plus size={20} /> {create.isPending ? "Lege an …" : "Anlegen"}
        </button>
      </form>
      {create.isError && <p className="form-error">{(create.error as Error).message}</p>}

      <QueryStates pending={playlists.isPending} error={playlists.error} isEmpty={!data.length} empty="Noch keine Playlists. Lege oben die erste an.">
        <ul className="album-grid">
          {data.map((playlist) => (
            <CoverTile
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              image={playlist.coverArt ? client.coverArtUrl(playlist.coverArt, 400) : undefined}
              title={playlist.name}
              subtitle={`${playlist.songCount ?? 0} Titel${playlist.duration ? ` · ${formatTime(playlist.duration)}` : ""}${playlist.readonly ? " · vom Server" : ""}`}
              fallback={<ListMusic size={36} />}
            />
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
