import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import CoverTile from "../components/CoverTile";
import PlaylistCover from "../components/PlaylistCover";
import QueryStates from "../components/QueryStates";
import { formatTime } from "../format";
import { useClient } from "../hooks/useClient";
import { useCreatePlaylist, usePlaylists } from "../hooks/playlists";
import { useT } from "../i18n";

/** Playlist-Übersicht mit Anlegen (`getPlaylists`, `createPlaylist`). */
export default function Playlists() {
  const t = useT();
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
      <h1>{t("nav.playlists")}</h1>
      <form className="filters" onSubmit={submit}>
        <label>
          <span className="sr-only">{t("playlists.nameLabel")}</span>
          <input type="text" placeholder={t("playlists.new")} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit" disabled={!name.trim() || create.isPending}>
          <Plus size={20} /> {create.isPending ? t("playlists.creating") : t("playlists.create")}
        </button>
      </form>
      {create.isError && <p className="form-error">{(create.error as Error).message}</p>}

      <QueryStates pending={playlists.isPending} error={playlists.error} isEmpty={!data.length} empty={t("playlists.empty")}>
        <ul className="album-grid">
          {data.map((playlist) => (
            <CoverTile
              key={playlist.id}
              to={`/playlist/${playlist.id}`}
              media={<PlaylistCover id={playlist.id} serverImage={playlist.coverArt ? client.coverArtUrl(playlist.coverArt, 400) : undefined} />}
              title={playlist.name}
              subtitle={`${t("count.tracks", { count: playlist.songCount ?? 0 })}${playlist.duration ? ` · ${formatTime(playlist.duration)}` : ""}${playlist.readonly ? ` · ${t("playlists.fromServer")}` : ""}`}
            />
          ))}
        </ul>
      </QueryStates>
    </>
  );
}
