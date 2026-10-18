import { useEffect } from "react";
import { usePlayer } from "../state/player";

/**
 * Elemente, in denen die Leertaste schon eine Aufgabe hat: tippen oder das
 * Element auslösen. Dort darf die Wiedergabe nicht umschalten.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return true;
  return target.closest("[role='textbox'], [role='slider'], [role='menu'], [role='menuitem']") !== null;
}

/**
 * Tastenkürzel im Fenster: Leertaste hält an und spielt weiter.
 * Ein globales Abfangen der Medientasten macht die Hülle (siehe Einstellungen).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      usePlayer.getState().toggle();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
