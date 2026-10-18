import type { ReactNode } from "react";
import { CircleAlert, Inbox } from "lucide-react";

interface QueryStatesProps {
  /** Aus der Abfrage: `query.isPending`. */
  pending: boolean;
  /** Aus der Abfrage: `query.error`. */
  error: Error | null;
  /** true, wenn die Abfrage erfolgreich war, aber nichts geliefert hat. */
  isEmpty?: boolean;
  /** Text des Leerzustands. */
  empty?: string;
  children: ReactNode;
}

/** Einheitlicher Lade-, Leer- und Fehlerzustand für alle Ansichten. */
export default function QueryStates({ pending, error, isEmpty = false, empty = "Nichts gefunden.", children }: QueryStatesProps) {
  if (pending)
    return (
      <div className="skeleton" role="status" aria-label="Lädt">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    );
  if (error)
    return (
      <p className="state error" role="alert">
        <CircleAlert size={20} /> {error.message}
      </p>
    );
  if (isEmpty)
    return (
      <p className="state">
        <Inbox size={20} /> {empty}
      </p>
    );
  return <>{children}</>;
}
