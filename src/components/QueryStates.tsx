import type { ReactNode } from "react";

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

/**
 * Einheitlicher Lade-, Leer- und Fehlerzustand für alle Ansichten.
 * Technik-Baustein: nutzt nur bestehende Klassen, die Optik kommt vom Design.
 */
export default function QueryStates({ pending, error, isEmpty = false, empty = "Nichts gefunden.", children }: QueryStatesProps) {
  if (pending) return <p className="muted">Lade …</p>;
  if (error) return <p className="form-error">{error.message}</p>;
  if (isEmpty) return <p className="muted">{empty}</p>;
  return <>{children}</>;
}
