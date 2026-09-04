"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Locale, Translations, getTranslation } from "@/lang";

export type Theme = "dark" | "light";

interface LanguageContextType {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: Translations;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);
const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_LANG_KEY = "kfonts_lang";
const STORAGE_THEME_KEY = "kfonts_theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read saved language
    try {
      const savedLang = localStorage.getItem(STORAGE_LANG_KEY) as Locale | null;
      if (savedLang === "en" || savedLang === "km") {
        setLangState(savedLang);
      }
    } catch {}

    // Read saved theme
    try {
      const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") {
        setThemeState(savedTheme);
      } else {
        // Default to dark mode for creative studio
        setThemeState("dark");
      }
    } catch {}

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
      document.documentElement.lang = lang;
    } catch {}
  }, [lang, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {}
  }, [theme, mounted]);

  const setLang = (newLang: Locale) => {
    setLangState(newLang);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const t = getTranslation(lang);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        {children}
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: "en",
      setLang: () => {},
      t: getTranslation("en"),
    };
  }
  return ctx;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
