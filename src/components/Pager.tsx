import { ChevronLeft, ChevronRight } from "lucide-react";

interface PagerProps {
  /** Aktuelle Seite, nullbasiert. */
  page: number;
  /** true, wenn der Server noch eine weitere Seite liefern kann. */
  hasNext: boolean;
  onPage: (page: number) => void;
}

/** Blättern für Listen, die der Server seitenweise liefert (`offset`). */
export default function Pager({ page, hasNext, onPage }: PagerProps) {
  if (page === 0 && !hasNext) return null;

  return (
    <p className="pager">
      <button type="button" className="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={18} /> Zurück
      </button>
      <span className="muted">Seite {page + 1}</span>
      <button type="button" className="ghost" disabled={!hasNext} onClick={() => onPage(page + 1)}>
        Weiter <ChevronRight size={18} />
      </button>
    </p>
  );
}
