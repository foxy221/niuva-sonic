import { useOffline } from "../state/offline";
import { useSession } from "../state/session";

/**
 * Adresse eines Covers: zuerst die lokale Datei aus der Offline-Ablage, sonst der Server.
 * Titel tragen eine eigene Cover-ID; das lokale Cover gehört zum Album und wird über `albumId` gefunden.
 */
export function useCoverUrl(coverArt: string | undefined, albumId: string | undefined, size: number): string | undefined {
  const client = useSession((s) => s.client);
  const local = useOffline((s) => (coverArt ? s.coverSource(coverArt, albumId) : null));
  if (!coverArt) return undefined;
  return local ?? client?.coverArtUrl(coverArt, size);
}
