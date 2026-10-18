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

const FAILURE_TEXT: Record<number, string> = {
  1: "Wiedergabe abgebrochen.",
  2: "Netzwerkfehler beim Laden des Titels.",
  3: "Die Datei lässt sich nicht dekodieren.",
  4: "Format nicht unterstützt oder Datei fehlt.",
};

export function describeMediaError(error: MediaError | null): MediaFailure {
  const code = error?.code ?? 4;
  return { code, message: FAILURE_TEXT[code] ?? "Unbekannter Wiedergabefehler." };
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

export class AudioEngine {
  private elements: [HTMLAudioElement, HTMLAudioElement];
  private primary: HTMLAudioElement;
  private standbyUrl: string | null = null;
  private pendingSeek = 0;

  constructor(private handlers: EngineHandlers) {
    this.elements = [new Audio(), new Audio()];
    for (const el of this.elements) {
      el.preload = "auto";
      this.wire(el);
    }
    this.primary = this.elements[0];
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
    this.clearStandby();
    this.pendingSeek = position;
    this.primary.src = url;
    if (autoplay) this.play();
    else this.primary.load();
  }

  play() {
    void this.primary.play().catch(() => this.handlers.onPause());
  }

  pause() {
    this.primary.pause();
  }

  seek(seconds: number) {
    try {
      this.primary.currentTime = Math.max(0, seconds);
    } catch {
      // Noch keine Metadaten geladen: die Position ist dann ohnehin 0.
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
    this.standbyUrl = null;
    this.pendingSeek = 0;
    previous.pause();
    previous.removeAttribute("src");
    previous.load();
    this.play();
    return true;
  }

  stop() {
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
    if (event.target === this.primary) run();
  }

  private wire(el: HTMLAudioElement) {
    el.addEventListener("play", (e) => this.ifPrimary(e, () => this.handlers.onPlay()));
    el.addEventListener("pause", (e) => this.ifPrimary(e, () => this.handlers.onPause()));
    el.addEventListener("timeupdate", (e) => this.ifPrimary(e, () => this.handlers.onTime(el.currentTime)));
    el.addEventListener("durationchange", (e) => this.ifPrimary(e, () => Number.isFinite(el.duration) && this.handlers.onDuration(el.duration)));
    el.addEventListener("loadedmetadata", (e) => this.ifPrimary(e, () => this.applyPendingSeek(el)));
    el.addEventListener("ended", (e) => this.ifPrimary(e, () => this.handlers.onEnded()));
    el.addEventListener("error", (e) => this.ifPrimary(e, () => this.handlers.onError(describeMediaError(el.error))));
    el.addEventListener("waiting", (e) => this.ifPrimary(e, () => this.handlers.onWaiting()));
    el.addEventListener("playing", (e) => this.ifPrimary(e, () => this.handlers.onReady()));
    el.addEventListener("canplay", (e) => this.ifPrimary(e, () => this.handlers.onReady()));
  }

  private applyPendingSeek(el: HTMLAudioElement) {
    if (this.pendingSeek <= 0) return;
    const position = this.pendingSeek;
    this.pendingSeek = 0;
    try {
      el.currentTime = position;
    } catch {
      // Kürzere Fassung als gespeichert (Transcoding): Position verwerfen.
    }
  }
}
