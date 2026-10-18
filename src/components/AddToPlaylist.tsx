import { useState, type FormEvent } from "react";
import { ListPlus } from "lucide-react";
import { usePlaylists, useUpdatePlaylist } from "../hooks/playlists";
import { useT } from "../i18n";

interface AddToPlaylistProps {
  /** Titel, die angehängt werden – ein Titel oder ein ganzes Album. */
  songIds: string[];
  label?: string;
}

/**
 * Bedienelement für `updatePlaylist`: Playlist wählen, Titel anhängen.
 * Serverseitig erzeugte Playlists sind schreibgeschützt und werden nicht angeboten.
 */
export default function AddToPlaylist({ songIds, label }: AddToPlaylistProps) {
  const t = useT();
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
      <label>
        <span className="sr-only">{t("playlistAdd.to")}</span>
        <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
          <option value="">{t("playlistAdd.choose")}</option>
          {writable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="ghost" disabled={!playlistId || !songIds.length || update.isPending}>
        <ListPlus size={18} /> {update.isPending ? t("playlistAdd.adding") : label ?? t("playlistAdd.add")}
      </button>
      {update.isError && <span className="form-error">{(update.error as Error).message}</span>}
    </form>
  );
}
