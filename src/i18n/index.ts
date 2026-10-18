import { create } from "zustand";
import { en, type Messages } from "./en";
import { de } from "./de";

export type Language = "en" | "de";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
];

export const DEFAULT_LANGUAGE: Language = "en";

const FILE = "settings.json";
const KEY = "language";
/** Dateien, die es nur gibt, wenn die App schon einmal benutzt wurde (0.1.x war deutsch). */
const EXISTING_INSTALL = [
  { file: "settings.json", key: "playbackSettings" },
  { file: "profiles.json", key: "profiles" },
  { file: "session.json", key: "credentials" },
];

/** Erst bei Bedarf laden: Tests ersetzen die Ablage, bevor sie zum ersten Mal gebraucht wird. */
const storage = () => import("../state/storage");

const dictionaries: Record<Language, Messages> = { en, de };
const locales: Record<Language, string> = { en: "en-US", de: "de-DE" };

/** Alle Schlüssel; Mehrzahlformen (`name_one`, `name_other`) zählen unter `name`. */
export type MessageKey = keyof Messages extends infer K
  ? K extends `${infer Base}_one` | `${infer Base}_other` ? Base : K
  : never;

export type Params = Record<string, string | number>;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "de";
}

interface LanguageState {
  language: Language;
  /** Erst wahr, wenn die gemerkte Sprache gelesen ist; vorher flackert sonst die falsche. */
  ready: boolean;
  restore: () => Promise<void>;
  setLanguage: (language: Language) => void;
}

let revision = 0;

async function write(language: Language) {
  try {
    await (await storage()).writeValue(FILE, KEY, language);
  } catch {
    // Die Wahl gilt trotzdem für diese Sitzung.
  }
}

/** Bestehende Installationen bleiben deutsch, frische starten mit der Vorgabe. */
async function read(file: string, key: string) {
  return (await storage()).readValue<unknown>(file, key);
}

async function initialLanguage(): Promise<Language> {
  const used = await Promise.all(
    EXISTING_INSTALL.map(({ file, key }) => read(file, key).then((value) => value !== null, () => false)),
  );
  return used.some(Boolean) ? "de" : DEFAULT_LANGUAGE;
}

export const useLanguage = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  ready: false,

  async restore() {
    const started = revision;
    const stored = await read(FILE, KEY).catch(() => null);
    let language: Language;
    if (isLanguage(stored)) language = stored;
    else {
      language = await initialLanguage();
      void write(language);
    }
    // Hat der Nutzer schon gewählt, während gelesen wurde, gilt seine Wahl.
    if (started === revision) set({ language, ready: true });
    else set({ ready: true });
  },

  setLanguage(language) {
    revision++;
    set({ language, ready: true });
    void write(language);
  },
}));

function interpolate(text: string, params?: Params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Text in einer bestimmten Sprache; fehlt er dort, gilt Englisch. */
export function translate(language: Language, key: MessageKey, params?: Params): string {
  const table = dictionaries[language] as Record<string, string>;
  const fallback = dictionaries.en as Record<string, string>;
  let name: string = key;
  if (params && typeof params.count === "number") {
    const form = new Intl.PluralRules(locales[language]).select(params.count);
    const plural = form === "one" ? "one" : "other";
    if (`${key}_${plural}` in table) name = `${key}_${plural}`;
    else if (`${key}_other` in table) name = `${key}_other`;
  }
  return interpolate(table[name] ?? fallback[name] ?? name, params);
}

/** Für Code außerhalb von Komponenten (Stores, Fehlertexte). */
export function t(key: MessageKey, params?: Params): string {
  return translate(useLanguage.getState().language, key, params);
}

/** Für Komponenten: rendert neu, wenn die Sprache wechselt. */
export function useT() {
  const language = useLanguage((s) => s.language);
  return (key: MessageKey, params?: Params) => translate(language, key, params);
}

export function currentLocale() {
  return locales[useLanguage.getState().language];
}

export function useLocale() {
  return locales[useLanguage((s) => s.language)];
}
