import { useEffect } from "react";
import { isDesktopApp, onPlayerCommand, type PlayerCommand } from "../state/desktop";
import { usePlayer } from "../state/player";

/** Was ein Befehl aus der Hülle im Player auslöst. */
export function runPlayerCommand(command: PlayerCommand) {
  const player = usePlayer.getState();
  if (command === "toggle") player.toggle();
  else if (command === "next") player.next();
  else if (command === "previous") player.prev();
}

/** Tray-Menü und systemweite Medientasten aus der Desktop-Hülle. */
export function usePlayerCommands() {
  useEffect(() => {
    if (!isDesktopApp()) return;
    let stop: (() => void) | null = null;
    let cancelled = false;

    void onPlayerCommand((command) => { if (!cancelled) runPlayerCommand(command); }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Desktop-Steuerung konnte nicht verbunden werden.", error);
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
}
