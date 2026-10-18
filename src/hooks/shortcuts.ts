/** Fenster-Tastenkürzel. Reine Zuordnung, damit sie ohne Oberfläche prüfbar ist und die Einstellungen sie anzeigen können. */
export type ShortcutAction = "toggle" | "volumeUp" | "volumeDown" | "next" | "prev" | "search" | "back" | "forward";

export interface ShortcutInfo {
  action: ShortcutAction;
  /** Tasten für die Anzeige als `<kbd>`. */
  keys: string[];
  label: `shortcut.${ShortcutAction}`;
}

export const SHORTCUTS: ShortcutInfo[] = [
  { action: "toggle", keys: ["Space"], label: "shortcut.toggle" },
  { action: "volumeUp", keys: ["Ctrl", "↑"], label: "shortcut.volumeUp" },
  { action: "volumeDown", keys: ["Ctrl", "↓"], label: "shortcut.volumeDown" },
  { action: "next", keys: ["Ctrl", "→"], label: "shortcut.next" },
  { action: "prev", keys: ["Ctrl", "←"], label: "shortcut.prev" },
  { action: "search", keys: ["Ctrl", "K"], label: "shortcut.search" },
  { action: "back", keys: ["Alt", "←"], label: "shortcut.back" },
  { action: "forward", keys: ["Alt", "→"], label: "shortcut.forward" },
];

type KeyLike = Pick<KeyboardEvent, "code" | "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey">;

/** Welche Aktion löst die Taste aus? `typing`: Fokus liegt in einem Eingabeelement. */
export function shortcutFor(event: KeyLike, typing: boolean): ShortcutAction | null {
  const { ctrlKey: ctrl, altKey: alt, metaKey: meta, shiftKey: shift } = event;
  if (meta) return null;
  if (!ctrl && !alt && !shift) return event.code === "Space" && !typing ? "toggle" : null;
  if (shift) return null;
  // Ctrl und Alt zusammen entspricht AltGr; das gehört dem Tippen.
  if (ctrl && alt) return null;
  if (ctrl) {
    if (event.key.toLowerCase() === "k") return "search";
    // Pfeile verschieben den Cursor im Textfeld und in Reglern.
    if (typing) return null;
    if (event.code === "ArrowUp") return "volumeUp";
    if (event.code === "ArrowDown") return "volumeDown";
    if (event.code === "ArrowRight") return "next";
    if (event.code === "ArrowLeft") return "prev";
    return null;
  }
  if (event.code === "ArrowLeft") return "back";
  if (event.code === "ArrowRight") return "forward";
  return null;
}
