"use client";

import { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-white/60">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 dark:border-white/10 dark:bg-black/30 dark:text-white/90 dark:focus:border-sky-500/60";
