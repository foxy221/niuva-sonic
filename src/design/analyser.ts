import { analysisSource } from "../state/player";

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let failed = false;

/** Ton läuft nach dem Einhängen über den AudioContext: bleibt der stehen, wäre es still. */
function keepRunning() {
  if (context && context.state !== "running") void context.resume().catch(() => {});
}

/**
 * Greift den Ton der Wiedergabe ab. Der Graph entsteht erst, wenn ihn jemand
 * braucht (Vollbild-Player geöffnet, also nach einem Klick), und lässt sich
 * danach nicht mehr aushängen. Liefert `null`, wo es nicht geht (Android,
 * Server ohne CORS); der Visualizer zeigt dann nur Ruhebewegung.
 */
export function getAnalyser(): AnalyserNode | null {
  if (analyser) {
    keepRunning();
    return analyser;
  }
  if (failed) return null;
  const elements = analysisSource();
  if (!elements) return null;
  try {
    context = new AudioContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    analyser.connect(context.destination);
    for (const element of elements) context.createMediaElementSource(element).connect(analyser);
    context.addEventListener("statechange", keepRunning);
    window.addEventListener("focus", keepRunning);
    keepRunning();
    return analyser;
  } catch {
    failed = true;
    analyser = null;
    void context?.close().catch(() => {});
    context = null;
    return null;
  }
}
