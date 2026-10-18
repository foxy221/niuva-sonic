import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { useLanguage } from "../src/i18n";

// Audio bleibt simuliert; getestet werden die echten Stores und ihre Events.
class TestAudio extends EventTarget {
  static instances = [];
  paused = true;
  currentTime = 0;
  duration = 0;
  volume = 1;
  src = "";

  constructor() {
    super();
    TestAudio.instances.push(this);
  }

  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }

  load() {
    this.currentTime = 0;
  }
}

vi.stubGlobal("Audio", TestAudio);
vi.stubGlobal("MediaMetadata", class {
  constructor(value) { Object.assign(this, value); }
});
Object.defineProperty(navigator, "mediaSession", {
  configurable: true,
  value: { metadata: null, playbackState: "none", setActionHandler: vi.fn() },
});

// Die Tests prüfen deutsche Texte; die App selbst startet mit Englisch.
useLanguage.setState({ language: "de", ready: true });

afterEach(() => {
  useLanguage.setState({ language: "de", ready: true });
  cleanup();
  vi.restoreAllMocks();
});

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
