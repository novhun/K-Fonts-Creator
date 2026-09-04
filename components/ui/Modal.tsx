"use client";

import { X } from "lucide-react";
import { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl transition-all dark:border-white/10 dark:bg-[#14161c]">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white/90">{title}</h2>
          <div className="flex items-center gap-1.5">
            <ThemeToggle className="!h-7 !w-7" />
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
