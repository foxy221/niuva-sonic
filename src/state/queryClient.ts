import { QueryClient } from "@tanstack/react-query";
import { useSession } from "./session";

export const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } });

// Auch laufende Abfragen entfernen: verspätete Antworten dürfen nicht in
// die Bibliothek einer neuen Sitzung gelangen.
useSession.subscribe((session, previous) => {
  if (session.client !== previous.client) queryClient.clear();
});
