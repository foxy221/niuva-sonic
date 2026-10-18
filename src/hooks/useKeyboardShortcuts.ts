import { useEffect } from "react";
import { usePlayer } from "../state/player";

/**
 * Elemente, in denen die Leertaste schon eine Aufgabe hat: tippen oder das
 * Element auslösen. Dort darf die Wiedergabe nicht umschalten.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest("input, textarea, select, button, a[href], summary, [role='button'], [role='checkbox'], [role='switch'], [role='radio'], [role='textbox'], [role='slider'], [role='menu'], [role='menuitem'], [role='combobox'], [role='listbox']") !== null;
}

/**
 * Tastenkürzel im Fenster: Leertaste hält an und spielt weiter.
 * Ein globales Abfangen der Medientasten macht die Hülle (siehe Einstellungen).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      usePlayer.getState().toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
