import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isDesktopApp } from "../state/desktop";
import { usePlayer } from "../state/player";

/** Auch auf der Login-Seite aktiv: erst den Zustand sichern, dann nativ beenden. */
export function useDesktopExit() {
  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    let exiting = false;
    void listen("app-exit-requested", () => {
      if (cancelled || exiting) return;
      exiting = true;
      void usePlayer.getState().flush()
        .catch((error: unknown) => console.error("Player-Zustand konnte nicht gespeichert werden.", error))
        .then(() => invoke("finish_exit"))
        .catch((error: unknown) => console.error("Beenden konnte nicht bestätigt werden.", error));
    }).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Beenden konnte nicht verbunden werden.", error);
    });
    return () => { cancelled = true; stop?.(); };
  }, []);
}
