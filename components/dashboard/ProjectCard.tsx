"use client";

import { FontProject } from "@/lib/types";
import { CircleDot, PenLine, Spline, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers/AppProviders";

const MODE_ICON = { outline: Spline, "single-line": PenLine, "dot-matrix": CircleDot, "dot-single-path": CircleDot } as const;

export default function ProjectCard({
  project,
  onDelete,
}: {
  project: FontProject;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const MODE_LABELS: Record<string, string> = {
    outline: t.dialogs.outlineMode,
    "single-line": t.dialogs.singleLineMode,
    "dot-matrix": t.dialogs.dotMatrixMode,
    "dot-single-path": t.dialogs.dotMatrixMode,
  };

  const date = new Date(project.updatedAt).toLocaleDateString(lang === "km" ? "km-KH" : undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      onClick={() => router.push(`/project/${project.id}`)}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-500/50 hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-sky-500/40 dark:hover:bg-white/[0.06]"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
        {(() => {
          const Icon = MODE_ICON[project.fontMode];
          return <Icon size={22} />;
        })()}
      </div>
      <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-white/90">{project.name}</h3>
      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-white/40">
        {project.author ? `${project.author} · ` : ""}v{project.version}
      </p>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-white/30">{MODE_LABELS[project.fontMode] || project.fontMode}</p>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-white/30">{date}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`${t.projects.deleteConfirm} (${project.name})`)) onDelete(project.id);
        }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-slate-400 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 transition-opacity dark:text-white/30 dark:hover:text-red-400"
        title={t.common.delete}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
