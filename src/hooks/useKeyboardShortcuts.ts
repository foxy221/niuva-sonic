import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../state/player";
import { shortcutFor } from "./shortcuts";

/**
 * Elemente, in denen die Leertaste schon eine Aufgabe hat: tippen oder das
 * Element auslösen. Dort darf die Wiedergabe nicht umschalten.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest("input, textarea, select, button, a[href], summary, [role='button'], [role='checkbox'], [role='switch'], [role='radio'], [role='textbox'], [role='slider'], [role='menu'], [role='menuitem'], [role='combobox'], [role='listbox']") !== null;
}

/** Nur Felder, in denen Cursor oder Pfeiltasten Text bewegen (Schaltflächen und Links zählen nicht). */
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest("input:not([type='range']):not([type='checkbox']):not([type='radio']):not([type='button']), textarea, select, [role='textbox'], [role='combobox'], [role='slider']") !== null;
}

const VOLUME_STEP = 0.05;

/**
 * Tastenkürzel im Fenster (Liste in `shortcuts.ts`, angezeigt in den Einstellungen).
 * Ein globales Abfangen der Medientasten macht die Hülle.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const space = event.code === "Space";
      // Leertaste: wie bisher überall dort gesperrt, wo sie etwas auslöst. Alles andere nur in Textfeldern.
      const typing = space ? isTypingTarget(event.target) : isTextField(event.target);
      const action = shortcutFor(event, typing);
      if (!action) return;
      if (event.repeat && (action === "toggle" || action === "search" || action === "back" || action === "forward")) return;
      event.preventDefault();
      const player = usePlayer.getState();
      switch (action) {
        case "toggle": player.toggle(); break;
        case "volumeUp": player.setVolume(Math.round((player.volume + VOLUME_STEP) * 100) / 100); break;
        case "volumeDown": player.setVolume(Math.round((player.volume - VOLUME_STEP) * 100) / 100); break;
        case "next": player.next(); break;
        case "prev": player.prev(); break;
        case "back": navigate(-1); break;
        case "forward": navigate(1); break;
        case "search": {
          const field = document.querySelector<HTMLInputElement>("input[data-search]");
          if (field) {
            field.focus();
            field.select();
          } else {
            navigate("/search");
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
