"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage, useTheme } from "@/components/providers/AppProviders";
import { Globe, Check, ChevronDown } from "lucide-react";
import { Locale } from "@/lang";

interface LanguageSelectorProps {
  className?: string;
  variant?: "dropdown" | "pills";
}

const LANGUAGES: { id: Locale; label: string; subLabel: string; flag: string }[] = [
  { id: "km", label: "ភាសាខ្មែរ", subLabel: "Khmer", flag: "🇰🇭" },
  { id: "en", label: "English", subLabel: "English (US)", flag: "🇬🇧" },
];

export default function LanguageSelector({ className = "", variant = "dropdown" }: LanguageSelectorProps) {
  const { lang, setLang, t } = useLanguage();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.id === lang) ?? LANGUAGES[0];

  if (variant === "pills") {
    return (
      <div
        className={`inline-flex items-center rounded-lg border p-0.5 text-xs ${
          theme === "dark" ? "border-white/10 bg-white/5" : "border-slate-300 bg-slate-100"
        } ${className}`}
      >
        {LANGUAGES.map((l) => {
          const isActive = lang === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
                isActive
                  ? theme === "dark"
                    ? "bg-sky-500/20 text-sky-300 shadow-sm border border-sky-500/30"
                    : "bg-white text-sky-700 shadow-sm border border-slate-200"
                  : theme === "dark"
                  ? "text-white/60 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        title={t.nav.switchLang}
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-all ${
          theme === "dark"
            ? "border-white/10 bg-white/5 text-white/85 hover:bg-white/10 hover:border-white/20 hover:text-white"
            : "border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900"
        }`}
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden sm:inline font-medium">{current.label}</span>
        <span className="inline sm:hidden font-mono uppercase font-bold text-[10px]">{current.id}</span>
        <ChevronDown size={13} className={`transition-transform duration-200 opacity-60 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-1.5 w-44 rounded-xl border p-1 shadow-xl backdrop-blur-xl z-50 ${
            theme === "dark"
              ? "border-white/15 bg-[#141824]/95 text-white shadow-black/60"
              : "border-slate-200 bg-white/95 text-slate-900 shadow-slate-400/20"
          }`}
        >
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-40">
            {t.nav.switchLang}
          </div>
          {LANGUAGES.map((l) => {
            const isSelected = lang === l.id;
            return (
              <button
                key={l.id}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? theme === "dark"
                      ? "bg-sky-500/20 text-sky-300 font-semibold"
                      : "bg-sky-50 text-sky-700 font-semibold"
                    : theme === "dark"
                    ? "text-white/80 hover:bg-white/5 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{l.flag}</span>
                  <div>
                    <div className="leading-tight">{l.label}</div>
                    <div className="text-[10px] opacity-50">{l.subLabel}</div>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-sky-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
