"use client";

import { useTheme, useLanguage } from "@/components/providers/AppProviders";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      onClick={toggleTheme}
      title={`${t.nav.toggleTheme} (${theme === "dark" ? t.nav.light : t.nav.dark})`}
      aria-label={t.nav.toggleTheme}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
        theme === "dark"
          ? "border-white/10 bg-white/5 text-amber-300 hover:bg-white/10 hover:border-amber-400/40 hover:text-amber-200"
          : "border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
      } ${className}`}
    >
      {theme === "dark" ? (
        <Sun size={17} className="transition-transform rotate-0 scale-100 hover:rotate-45 duration-300 text-amber-300" />
      ) : (
        <Moon size={17} className="transition-transform rotate-0 scale-100 hover:-rotate-12 duration-300 text-indigo-600" />
      )}
    </button>
  );
}
