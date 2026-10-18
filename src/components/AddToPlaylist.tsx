import { useState, type FormEvent } from "react";
import { usePlaylists, useUpdatePlaylist } from "../hooks/playlists";

interface AddToPlaylistProps {
  /** Titel, die angehängt werden – ein Titel oder ein ganzes Album. */
  songIds: string[];
  label?: string;
}

/**
 * Minimales Bedienelement für `updatePlaylist`: Playlist wählen, Titel anhängen.
 * Serverseitig erzeugte Playlists sind schreibgeschützt und werden nicht angeboten.
 */
export default function AddToPlaylist({ songIds, label = "Hinzufügen" }: AddToPlaylistProps) {
  const playlists = usePlaylists();
  const [playlistId, setPlaylistId] = useState("");
  const update = useUpdatePlaylist(playlistId);
  const writable = (playlists.data ?? []).filter((p) => !p.readonly);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!playlistId) return;
    update.mutate({ songIdsToAdd: songIds });
  }

  if (!writable.length) return null;

  return (
    <form className="add-to-playlist" onSubmit={submit}>
      <label className="muted">
        Zu Playlist
        <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
          <option value="">Playlist wählen …</option>
          {writable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="ghost" disabled={!playlistId || !songIds.length || update.isPending}>
        {update.isPending ? "Hänge an …" : label}
      </button>
      {update.isError && <span className="form-error">{(update.error as Error).message}</span>}
    </form>
  );
}
