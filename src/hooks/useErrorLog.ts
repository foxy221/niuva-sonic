import { useEffect } from "react";
import { logError } from "../state/log";

/**
 * Unerwartete Fehler aus dem Fenster ins Protokoll schreiben.
 *
 * Behandelte Fehler (Serverantworten, Downloads) melden sich an ihrer Stelle
 * gezielt; hier landen nur Abstürze und abgewiesene Zusagen, die sonst nur in
 * der Entwicklerkonsole stünden.
 */
export function useErrorLog() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => logError(event.error ?? event.message, "Unexpected error");
    const onRejection = (event: PromiseRejectionEvent) => logError(event.reason, "Unhandled promise rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}
