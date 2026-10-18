import type { SubsonicClient } from "../api/subsonic";
import { useSession } from "../state/session";

/**
 * Der Client der angemeldeten Sitzung. Alle Ansichten hinter der Anmeldung
 * laufen damit; ohne Sitzung zeigt `App` ohnehin den Login.
 */
export function useClient(): SubsonicClient {
  const client = useSession((s) => s.client);
  if (!client) throw new Error("Keine Verbindung zum Server.");
  return client;
}
