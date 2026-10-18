import { ListMusic } from "lucide-react";
import { usePlaylist } from "../hooks/playlists";
import { useCoverUrl } from "../hooks/useCoverUrl";
import type { Song } from "../api/types";

/** Eine Kachel des Mosaiks. */
function Cell({ song }: { song: Song }) {
  const url = useCoverUrl(song.coverArt, song.albumId, 200);
  return url ? <img src={url} alt="" loading="lazy" /> : <div className="cover-empty" />;
}

/** Erste Titel mit verschiedenen Covern, höchstens vier. */
export function mosaicSongs(songs: Song[] | undefined): Song[] {
  const seen = new Set<string>();
  const result: Song[] = [];
  for (const song of songs ?? []) {
    const key = song.coverArt ?? song.albumId;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(song);
    if (result.length === 4) break;
  }
  return result;
}

interface PlaylistCoverProps {
  id: string;
  /** Cover des Servers, solange die Titel laden oder zu wenige verschiedene Cover vorhanden sind. */
  serverImage?: string;
}

/** Playlist-Cover: Mosaik aus vier Covern der ersten Titel, bei weniger verschiedenen Covern das erste allein. */
export default function PlaylistCover({ id, serverImage }: PlaylistCoverProps) {
  const playlist = usePlaylist(id);
  const picks = mosaicSongs(playlist.data?.entry);
  if (picks.length >= 4) {
    return <div className="mosaic">{picks.map((song) => <Cell key={song.id} song={song} />)}</div>;
  }
  if (picks.length > 0) return <div className="mosaic single"><Cell song={picks[0]} /></div>;
  if (serverImage) return <div className="mosaic single"><img src={serverImage} alt="" loading="lazy" /></div>;
  return <div className="cover-empty"><ListMusic size={36} /></div>;
}
