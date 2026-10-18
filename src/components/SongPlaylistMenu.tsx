import { useEffect, useRef, useState } from "react";
import { Check, ListMusic } from "lucide-react";
import { useAddToPlaylist, usePlaylists } from "../hooks/playlists";

/** Liste der beschreibbaren Playlists; lädt sie erst, wenn das Menü offen ist. */
function PlaylistChoices({ songId, onDone }: { songId: string; onDone: () => void }) {
  const playlists = usePlaylists();
  const add = useAddToPlaylist();
  const [added, setAdded] = useState<string | null>(null);
  const writable = (playlists.data ?? []).filter((playlist) => !playlist.readonly);

  function choose(playlistId: string) {
    add.mutate({ playlistId, songIds: [songId] }, {
      onSuccess: () => {
        setAdded(playlistId);
        window.setTimeout(onDone, 700);
      },
    });
  }

  if (playlists.isPending) return <p className="menu-note muted">Lade Playlists …</p>;
  if (playlists.isError) return <p className="menu-note form-error">{(playlists.error as Error).message}</p>;
  if (!writable.length) return <p className="menu-note muted">Noch keine eigene Playlist. Lege unter „Playlists“ eine an.</p>;

  return (
    <>
      <ul>
        {writable.map((playlist) => (
          <li key={playlist.id}>
            <button type="button" role="menuitem" className="menu-item" disabled={add.isPending} onClick={() => choose(playlist.id)}>
              <span>{playlist.name}</span>
              {added === playlist.id && <Check size={16} aria-label="Hinzugefügt" />}
            </button>
          </li>
        ))}
      </ul>
      {add.isError && <p className="menu-note form-error" role="alert">{(add.error as Error).message}</p>}
    </>
  );
}

/** Einzelnen Titel an eine Playlist hängen: Knopf in der Zeile, Menü mit den Playlists. */
export default function SongPlaylistMenu({ songId }: { songId: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return (
    <span className="menu-anchor" ref={root}>
      <button
        type="button"
        className="icon row-action"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Zu Playlist hinzufügen"
        title="Zu Playlist hinzufügen"
        onClick={() => setOpen((value) => !value)}
      >
        <ListMusic size={18} />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Playlist wählen">
          <PlaylistChoices songId={songId} onDone={() => setOpen(false)} />
        </div>
      )}
    </span>
  );
}
