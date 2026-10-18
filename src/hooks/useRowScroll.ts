import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Wie weit ein Pfeil die Reihe schiebt, relativ zur sichtbaren Breite. */
const STEP = 0.85;
/** Unter dieser Strecke gilt eine Mausbewegung noch als Klick. */
const DRAG_THRESHOLD = 5;

/**
 * Horizontal scrollbare Reihe: Ziehen mit der Maus, Pfeile nach links und rechts,
 * die nur erscheinen, solange es in diese Richtung noch etwas zu sehen gibt.
 * `watch` ändert sich, wenn Inhalte dazukommen oder wegfallen.
 */
export function useRowScroll<T extends HTMLElement>(watch: unknown) {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [update, watch]);

  const scrollBySteps = useCallback((direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * STEP, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const handlers = {
    onPointerDown(event: ReactPointerEvent<T>) {
      // Berührung und Stift scrollen von selbst; nur die Maus muss ziehen.
      if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
      drag.current = { x: event.clientX, scrollLeft: ref.current.scrollLeft, moved: false };
    },
    onPointerMove(event: ReactPointerEvent<T>) {
      const state = drag.current;
      const el = ref.current;
      if (!state || !el) return;
      const distance = event.clientX - state.x;
      if (!state.moved && Math.abs(distance) < DRAG_THRESHOLD) return;
      if (!state.moved) {
        state.moved = true;
        setDragging(true);
      }
      el.scrollLeft = state.scrollLeft - distance;
    },
    onPointerUp() {
      if (drag.current?.moved) {
        // Das Loslassen über einem Cover soll keinen Link öffnen.
        const swallow = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      }
      drag.current = null;
      setDragging(false);
    },
    onPointerLeave() {
      drag.current = null;
      setDragging(false);
    },
    onDragStart(event: { preventDefault: () => void }) {
      event.preventDefault();
    },
  };

  return { ref, canScrollLeft: edges.left, canScrollRight: edges.right, scrollBySteps, dragging, handlers };
}
