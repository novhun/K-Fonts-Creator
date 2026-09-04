"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Field, inputClass } from "@/components/ui/Field";
import { FontMode, FontProject } from "@/lib/types";
import clsx from "clsx";
import { CircleDot, PenLine, Spline } from "lucide-react";
import { useLanguage } from "@/components/providers/AppProviders";

const UNITS_PER_EM = 1000;

export default function NewProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (project: FontProject) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [fontMode, setFontMode] = useState<FontMode>("outline");
  const [strokeWidth, setStrokeWidth] = useState(Math.round(UNITS_PER_EM * 0.04));
  const [dotSpacing, setDotSpacing] = useState(Math.round(UNITS_PER_EM * 0.045));
  const [dotRadius, setDotRadius] = useState(Math.round(UNITS_PER_EM * 0.012));

  const STYLES: { id: FontMode; label: string; hint: string; icon: typeof Spline }[] = [
    { id: "outline", label: t.dialogs.outlineMode, hint: "Filled shapes — standard text font", icon: Spline },
    { id: "single-line", label: t.dialogs.singleLineMode, hint: "Open strokes — engraving / plotter", icon: PenLine },
    { id: "dot-matrix", label: t.dialogs.dotMatrixMode, hint: "2D Dot grid — LED / Matrix style", icon: CircleDot },
    { id: "dot-single-path", label: "Dot Single Path", hint: "Tracing dots along stroke path", icon: CircleDot },
  ];

  function handleCreate() {
    if (!name.trim()) return;
    const now = Date.now();
    const project: FontProject = {
      id: crypto.randomUUID(),
      name: name.trim(),
      author: author.trim(),
      version: version.trim() || "1.0.0",
      unitsPerEm: UNITS_PER_EM,
      ascender: 800,
      descender: -200,
      capHeight: 700,
      xHeight: 500,
      fontMode,
      strokeWidth,
      dotSpacing,
      dotRadius,
      createdAt: now,
      updatedAt: now,
    };
    onCreate(project);
  }

  return (
    <Modal title={t.dialogs.newProjectTitle} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t.dialogs.projectName}>
          <input
            autoFocus
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Custom Font"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t.common.author}>
            <input
              className={inputClass}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label={t.common.version}>
            <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
        </div>

        <Field label={t.dialogs.fontMode}>
          <div className="grid grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFontMode(s.id)}
                className={clsx(
                  "flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-all",
                  fontMode === s.id
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                )}
              >
                <s.icon size={16} className={fontMode === s.id ? "text-sky-600 dark:text-sky-400" : "text-slate-500 dark:text-white/50"} />
                <span className="text-xs font-medium text-slate-800 dark:text-white/90">{s.label}</span>
                <span className="text-[10px] leading-snug text-slate-400 dark:text-white/40">{s.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        {fontMode === "single-line" && (
          <Field label="Stroke Width (font units)">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        )}

        {(fontMode === "dot-matrix" || fontMode === "dot-single-path") && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dot Spacing (font units)">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={dotSpacing}
                onChange={(e) => setDotSpacing(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label="Dot Radius (font units)">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={dotRadius}
                onChange={(e) => setDotRadius(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/6">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white/90"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="rounded-md bg-sky-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
          >
            {t.dialogs.createBtn}
          </button>
        </div>
      </div>
    </Modal>
  );
}
