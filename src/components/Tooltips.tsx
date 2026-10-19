import { useEffect, useRef, useState } from "react";

/**
 * Ersetzt die trägen Browser-Tooltips (`title`) durch einen eigenen, der fast sofort erscheint.
 * Ein einziger Zuhörer am Dokument: das `title` wandert beim ersten Überfahren in `data-tip`,
 * damit der Browser keinen zweiten Tooltip dazulegt.
 */
export default function Tooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    const hide = () => { window.clearTimeout(timer.current); setTip(null); };
    const show = (el: HTMLElement, delay: number) => {
      const text = el.dataset.tip;
      if (!text) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        const below = r.top < 48;
        setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80), y: below ? r.bottom + 8 : r.top - 8, below });
      }, delay);
    };
    const find = (target: EventTarget | null) => {
      const el = (target instanceof Element ? target.closest("[title], [data-tip]") : null) as HTMLElement | null;
      if (!el) return null;
      const title = el.getAttribute("title");
      if (title) { el.dataset.tip = title; el.removeAttribute("title"); }
      return el.dataset.tip ? el : null;
    };
    const over = (e: PointerEvent) => { const el = find(e.target); if (el) show(el, 140); else hide(); };
    const focus = (e: FocusEvent) => { const el = find(e.target); if (el && (e.target as HTMLElement).matches(":focus-visible")) show(el, 0); };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  return <div className={`tooltip${tip.below ? " below" : ""}`} style={{ left: tip.x, top: tip.y }} role="presentation">{tip.text}</div>;
}
