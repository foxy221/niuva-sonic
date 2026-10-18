import { t, type MessageKey } from "../i18n";
/**
 * Zwei Audio-Elemente: eines spielt, das zweite lädt den nächsten Titel vor und
 * übernimmt ihn beim Titelwechsel. Damit fehlt nur die Umschaltzeit des Elements,
 * nicht die Ladezeit über das Netz. Eine wirklich samplegenaue Überblendung
 * (Web Audio mit dekodierten Puffern) wäre die nächste Stufe.
 */

export interface MediaFailure {
  code: number;
  message: string;
}

const FAILURE_TEXT: Record<number, MessageKey> = {
  1: "playerError.aborted",
  2: "playerError.network",
  3: "playerError.decode",
  4: "playerError.unsupported",
};

export function describeMediaError(error: MediaError | null): MediaFailure {
  const code = error?.code ?? 4;
  return { code, message: t(FAILURE_TEXT[code] ?? "playerError.unknown") };
}

export interface EngineHandlers {
  onPlay: () => void;
  onPause: () => void;
  onTime: (position: number) => void;
  onDuration: (duration: number) => void;
  onEnded: () => void;
  onError: (failure: MediaFailure) => void;
  onWaiting: () => void;
  onReady: () => void;
}

/**
 * Die Klanganalyse für den Visualizer braucht CORS-fähige Audio-Elemente und
 * leitet den Ton über Web Audio um. Das gilt vorerst nur am Desktop: auf Android
 * bleibt der Ton unberührt, bis die Hintergrundwiedergabe dort steht.
 */
export function analysisSupported() {
  if (typeof AudioContext === "undefined" || typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export class AudioEngine {
  private elements: [HTMLAudioElement, HTMLAudioElement];
  private primary: HTMLAudioElement;
  private standbyUrl: string | null = null;
  private pendingSeek = 0;
  private revision = 0;
  private changing = false;
  private active = false;
  private analysis: boolean;

  constructor(private handlers: EngineHandlers, options: { analysis?: boolean } = {}) {
    this.analysis = Boolean(options.analysis);
    this.elements = [new Audio(), new Audio()];
    for (const el of this.elements) {
      el.preload = "auto";
      if (this.analysis) el.crossOrigin = "anonymous";
      this.wire(el);
    }
    this.primary = this.elements[0];
  }

  /** Die beiden Elemente, damit der Visualizer den Ton abgreifen kann. */
  get audioElements(): readonly HTMLAudioElement[] {
    return this.elements;
  }

  /** false, sobald der Server kein CORS erlaubt hat und die Analyse abgeschaltet wurde. */
  get analysisActive() {
    return this.analysis;
  }

  get element() {
    return this.primary;
  }

  get position() {
    return this.primary.currentTime || 0;
  }

  get duration() {
    return Number.isFinite(this.primary.duration) ? this.primary.duration : 0;
  }

  get paused() {
    return this.primary.paused;
  }

  load(url: string, options: { position?: number; autoplay?: boolean } = {}) {
    const { position = 0, autoplay = true } = options;
    this.revision++;
    this.changing = true;
    this.primary.pause();
    this.clearStandby();
    this.pendingSeek = Number.isFinite(position) ? Math.max(0, position) : 0;
    this.primary.src = url;
    this.primary.load();
    this.active = true;
    this.changing = false;
    if (autoplay) this.play();
  }

  play() {
    if (!this.active) return;
    const revision = this.revision;
    const el = this.primary;
    void el.play().catch((error: unknown) => {
      if (revision !== this.revision || el !== this.primary) return;
      this.handlers.onPause();
      // Ein durch load/stop abgebrochener Start ist kein defekter Titel.
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (el.error) return; // Das error-Ereignis liefert bereits die konkrete Meldung.
      this.handlers.onError({ code: 0, message: t("playerError.start") });
    });
  }

  pause() {
    this.primary.pause();
  }

  seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    const position = Math.max(0, Math.min(seconds, this.duration || seconds));
    this.pendingSeek = 0;
    try {
      this.primary.currentTime = position;
    } catch {
      this.pendingSeek = position;
    }
  }

  setVolume(volume: number) {
    const value = Math.max(0, Math.min(1, volume));
    for (const el of this.elements) el.volume = value;
  }

  /** Nächsten Titel vorladen; `null` gibt den Platz wieder frei. */
  preload(url: string | null) {
    if (!url) {
      this.clearStandby();
      return;
    }
    if (this.standbyUrl === url) return;
    const standby = this.standby();
    this.standbyUrl = url;
    standby.preload = "auto";
    standby.src = url;
    standby.load();
  }

  /** Übernimmt den vorgeladenen Titel, sobald er bereitliegt. */
  takePreloaded(url: string): boolean {
    const standby = this.standby();
    // Bewusst `>= 3` statt `< 3`: fehlt `readyState`, ist der Vergleich sonst wirkungslos.
    if (this.standbyUrl !== url || !(standby.readyState >= 3)) return false;
    const previous = this.primary;
    // Erst umschalten, dann pausieren: das Pause-Ereignis gehört zum alten
    // Element und darf den Zustand nicht auf „angehalten“ setzen.
    this.primary = standby;
    this.revision++;
    this.active = true;
    this.standbyUrl = null;
    this.pendingSeek = 0;
    previous.pause();
    previous.removeAttribute("src");
    previous.load();
    // Metadaten-Ereignisse des Standby wurden absichtlich ignoriert.
    if (this.duration > 0) this.handlers.onDuration(this.duration);
    this.play();
    return true;
  }

  stop() {
    this.revision++;
    this.active = false;
    for (const el of this.elements) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    this.standbyUrl = null;
    this.pendingSeek = 0;
    this.primary = this.elements[0];
  }

  private standby() {
    return this.primary === this.elements[0] ? this.elements[1] : this.elements[0];
  }

  private clearStandby() {
    const standby = this.standby();
    this.standbyUrl = null;
    standby.removeAttribute("src");
    standby.load();
  }

  /** Ereignisse des zweiten Elements dürfen den Zustand nicht verändern. */
  private ifPrimary(event: Event, run: () => void) {
    if (this.active && !this.changing && event.target === this.primary) run();
  }

  private wire(el: HTMLAudioElement) {
    el.addEventListener("play", (e) => this.ifPrimary(e, () => this.handlers.onPlay()));
    el.addEventListener("pause", (e) => this.ifPrimary(e, () => this.handlers.onPause()));
    el.addEventListener("timeupdate", (e) => this.ifPrimary(e, () => this.handlers.onTime(el.currentTime)));
    el.addEventListener("durationchange", (e) => this.ifPrimary(e, () => Number.isFinite(el.duration) && this.handlers.onDuration(el.duration)));
    el.addEventListener("loadedmetadata", (e) => this.ifPrimary(e, () => this.applyPendingSeek(el)));
    el.addEventListener("ended", (e) => this.ifPrimary(e, () => this.handlers.onEnded()));
    el.addEventListener("error", (e) => {
      if (this.retryWithoutCors(el)) return;
      this.ifPrimary(e, () => this.handlers.onError(describeMediaError(el.error)));
    });
    el.addEventListener("waiting", (e) => this.ifPrimary(e, () => this.handlers.onWaiting()));
    el.addEventListener("playing", (e) => this.ifPrimary(e, () => this.handlers.onReady()));
    el.addEventListener("canplay", (e) => this.ifPrimary(e, () => this.handlers.onReady()));
  }

  /**
   * Erlaubt der Server kein CORS, lädt das Element mit `crossOrigin` gar nicht.
   * Dann ohne Analyse neu starten, statt die Wiedergabe zu verlieren.
   */
  private retryWithoutCors(el: HTMLAudioElement): boolean {
    if (!this.analysis || !el.crossOrigin || !el.src) return false;
    this.analysis = false;
    const wasPrimary = el === this.primary;
    const position = el.currentTime || 0;
    for (const other of this.elements) other.removeAttribute("crossorigin");
    const src = el.src;
    el.src = src;
    el.load();
    if (wasPrimary) {
      this.pendingSeek = position;
      this.play();
    }
    return true;
  }

  private applyPendingSeek(el: HTMLAudioElement) {
    if (this.pendingSeek <= 0) return;
    const position = Math.min(this.pendingSeek, this.duration || this.pendingSeek);
    this.pendingSeek = 0;
    try {
      el.currentTime = position;
    } catch {
      // Kürzere Fassung als gespeichert (Transcoding): Position verwerfen.
    }
  }
}
