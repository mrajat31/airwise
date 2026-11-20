import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./en.js";
import { hi } from "./hi.js";
import { mr } from "./mr.js";

export const LANGUAGES = [
  { id: "en", label: "English", locale: "en-IN" },
  { id: "mr", label: "मराठी", locale: "mr-IN" },
  { id: "hi", label: "हिन्दी", locale: "hi-IN" },
];
export const LANGUAGE_STORAGE_KEY = "airwise.lang";
const DICTIONARIES = { en, mr, hi };

/** Replaces `{name}` placeholders with values from `vars`. */
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match));
}

/** A translate function for `lang`, falling back to English and then to the key itself. */
export function makeTranslator(lang) {
  const dictionary = DICTIONARIES[lang] ?? en;
  return (key, vars) => interpolate(dictionary[key] ?? en[key] ?? key, vars);
}

export function detectLanguage(stored, browserLanguages = []) {
  if (DICTIONARIES[stored]) return stored;
  const match = browserLanguages.map((tag) => String(tag).slice(0, 2).toLowerCase()).find((code) => DICTIONARIES[code]);
  return match ?? "en";
}

function readInitialLanguage() {
  let stored = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage may be blocked; fall back to the browser language.
  }
  return detectLanguage(stored, typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]);
}

const englishContext = { lang: "en", locale: "en-IN", setLang: () => {}, t: makeTranslator("en") };
const I18nContext = createContext(englishContext);

export function I18nProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(() => initialLang ?? readInitialLanguage());
  const setLang = useCallback((next) => {
    if (!DICTIONARIES[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({
    lang,
    locale: LANGUAGES.find((language) => language.id === lang)?.locale ?? "en-IN",
    setLang,
    t: makeTranslator(lang),
  }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `{ lang, locale, setLang, t }`. Outside a provider it returns English. */
export function useI18n() {
  return useContext(I18nContext);
}
