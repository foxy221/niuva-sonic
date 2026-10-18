import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "../i18n";

interface PagerProps {
  /** Aktuelle Seite, nullbasiert. */
  page: number;
  /** true, wenn der Server noch eine weitere Seite liefern kann. */
  hasNext: boolean;
  onPage: (page: number) => void;
}

/** Blättern für Listen, die der Server seitenweise liefert (`offset`). */
export default function Pager({ page, hasNext, onPage }: PagerProps) {
  const t = useT();
  if (page === 0 && !hasNext) return null;

  return (
    <p className="pager">
      <button type="button" className="ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={18} /> {t("pager.previous")}
      </button>
      <span className="muted">{t("pager.page", { page: page + 1 })}</span>
      <button type="button" className="ghost" disabled={!hasNext} onClick={() => onPage(page + 1)}>
        {t("pager.next")} <ChevronRight size={18} />
      </button>
    </p>
  );
}
