import type { ReactNode } from "react";
import { CircleAlert, Inbox } from "lucide-react";
import { useT } from "../i18n";

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
export default function QueryStates({ pending, error, isEmpty = false, empty, children }: QueryStatesProps) {
  const t = useT();
  if (pending)
    return (
      <div className="skeleton" role="status" aria-label={t("common.loading")}>
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
        <Inbox size={20} /> {empty ?? t("common.nothing")}
      </p>
    );
  return <>{children}</>;
}
