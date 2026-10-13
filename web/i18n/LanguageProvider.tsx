"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALE_KEY, localizedNumber, translate, type Locale, type Translator } from "./translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
  formatNumber: (value: number | null | undefined, digits?: number) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("fr");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_KEY);
      if (saved === "fr" || saved === "en") updateLocale(saved);
    } catch {
      // Language switching also works when browser storage is unavailable.
    }
    function syncLanguage(event: StorageEvent) {
      if (event.key === LOCALE_KEY && (event.newValue === "fr" || event.newValue === "en")) updateLocale(event.newValue);
    }
    window.addEventListener("storage", syncLanguage);
    return () => window.removeEventListener("storage", syncLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.querySelector('meta[name="description"]')?.setAttribute("content", translate(locale, "Sélection caméra et objectif pour vision industrielle"));
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    updateLocale(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // Keep the selected language for this session without affecting studies.
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (text, values) => translate(locale, text, values),
    formatNumber: (number, digits) => localizedNumber(locale, number, digits)
  }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useTranslation must be used inside LanguageProvider");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  return (
    <div className="language-switcher" role="group" aria-label={t("Langue")}>
      <button type="button" lang="fr" aria-label="Français" aria-pressed={locale === "fr"} onClick={() => setLocale("fr")}>FR</button>
      <button type="button" lang="en" aria-label="English" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    </div>
  );
}
