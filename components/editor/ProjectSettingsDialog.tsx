"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Field, inputClass } from "@/components/ui/Field";
import { useProjectStore } from "@/lib/projectStore";
import { CircleDot, Loader2, PenLine, Spline } from "lucide-react";
import { FontMode } from "@/lib/types";
import clsx from "clsx";

const STYLES: { id: FontMode; label: string; icon: typeof Spline }[] = [
  { id: "outline", label: "Outline", icon: Spline },
  { id: "single-line", label: "Single-Line", icon: PenLine },
  { id: "dot-matrix", label: "Dot Matrix", icon: CircleDot },
  { id: "dot-single-path", label: "Dot Single Path", icon: CircleDot },
];

const CONVERT_NOTES: Record<FontMode, string> = {
  outline: "Exact — stroke/dot shapes are expanded or reused as filled outlines directly.",
  "single-line": "Best-effort — extracts an approximate centerline skeleton; sharp junctions may need manual cleanup.",
  "dot-matrix": "2D Grid — samples a uniform dot grid over the filled shape (LED/Matrix style).",
  "dot-single-path": "Single Path — samples equidistant dots along the single stroke path (school tracing style).",
};

export default function ProjectSettingsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const glyphs = useProjectStore((s) => s.glyphs);
  const converting = useProjectStore((s) => s.converting);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const convertFontMode = useProjectStore((s) => s.convertFontMode);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<FontMode | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  if (!project) return null;

  const drawnCount = Object.values(glyphs).filter((g) => g.path.length > 0).length;

  function handleSelectMode(targetMode: FontMode) {
    if (!project || targetMode === project.fontMode) return;
    setConvertError(null);
    setConvertSuccess(null);
    if (drawnCount > 0) {
      setConfirmTarget(targetMode);
    } else {
      executeConvert(targetMode);
    }
  }

  async function executeConvert(targetMode?: FontMode) {
    const mode = targetMode || confirmTarget;
    if (!mode || !project) return;
    setConvertError(null);
    setConvertSuccess(null);
    const modeLabel =
      mode === "dot-single-path"
        ? "Dot Single Path"
        : mode === "dot-matrix"
        ? "Dot Matrix"
        : mode === "single-line"
        ? "Single-Line"
        : "Outline";
    try {
      await convertFontMode(mode);
      setConfirmTarget(null);
      setConvertSuccess(`Successfully converted to ${modeLabel}!`);
    } catch (e) {
      console.error(e);
      setConvertError(e instanceof Error ? e.message : "Conversion failed.");
    }
  }

  return (
    <Modal title="Font Settings" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Font Name">
            <input className={inputClass} value={project.name} onChange={(e) => updateProjectMeta({ name: e.target.value })} />
          </Field>
          <Field label="Author">
            <input className={inputClass} value={project.author} onChange={(e) => updateProjectMeta({ author: e.target.value })} />
          </Field>
        </div>
        <Field label="Version">
          <input className={inputClass} value={project.version} onChange={(e) => updateProjectMeta({ version: e.target.value })} />
        </Field>

        <div className="border-t border-white/10 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">Metrics (font units)</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Units Per Em">
              <input
                type="number"
                className={inputClass}
                value={project.unitsPerEm}
                onChange={(e) => updateProjectMeta({ unitsPerEm: Number(e.target.value) || 1000 })}
              />
            </Field>
            <Field label="Ascender">
              <input
                type="number"
                className={inputClass}
                value={project.ascender}
                onChange={(e) => updateProjectMeta({ ascender: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Descender (negative)">
              <input
                type="number"
                className={inputClass}
                value={project.descender}
                onChange={(e) => updateProjectMeta({ descender: Math.min(0, Number(e.target.value) || 0) })}
              />
            </Field>
            <Field label="Cap Height">
              <input
                type="number"
                className={inputClass}
                value={project.capHeight}
                onChange={(e) => updateProjectMeta({ capHeight: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="X-Height">
              <input
                type="number"
                className={inputClass}
                value={project.xHeight}
                onChange={(e) => updateProjectMeta({ xHeight: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Glyph Style</p>
            {converting && (
              <span className="flex items-center gap-1.5 text-[11px] text-white/50">
                <Loader2 size={12} className="animate-spin" /> Converting…
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={converting}
                onClick={() => handleSelectMode(s.id)}
                title={s.id === project.fontMode ? "Current style" : CONVERT_NOTES[s.id]}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center disabled:opacity-50",
                  s.id === project.fontMode
                    ? "border-sky-500 bg-sky-500/10"
                    : confirmTarget === s.id
                    ? "border-amber-500/80 bg-amber-500/15"
                    : "border-white/10 hover:bg-white/5"
                )}
              >
                <s.icon
                  size={16}
                  className={
                    s.id === project.fontMode
                      ? "text-sky-400"
                      : confirmTarget === s.id
                      ? "text-amber-400"
                      : "text-white/50"
                  }
                />
                <span className="text-[11px] font-medium text-white/90">{s.label}</span>
              </button>
            ))}
          </div>
          {confirmTarget && (
            <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <p className="font-semibold text-amber-300">
                Convert all {drawnCount} drawn glyphs to{" "}
                {confirmTarget === "dot-single-path"
                  ? "Dot Single Path"
                  : confirmTarget === "dot-matrix"
                  ? "Dot Matrix"
                  : confirmTarget === "single-line"
                  ? "Single-Line"
                  : "Outline"}
                ?
              </p>
              <p className="mt-1 text-white/70">
                {CONVERT_NOTES[confirmTarget]} This replaces current glyph contours.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => executeConvert()}
                  className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-medium text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {converting ? <Loader2 size={13} className="animate-spin" /> : null}
                  Yes, Convert
                </button>
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => setConfirmTarget(null)}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-white/60 hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {convertSuccess && <p className="mt-2 text-[11px] font-medium text-emerald-400">✓ {convertSuccess}</p>}
          {convertError && <p className="mt-1.5 text-[11px] text-red-400">{convertError}</p>}
          {project.fontMode === "single-line" && (
            <div className="mt-2">
              <Field label="Stroke Width (font units)">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={project.strokeWidth}
                  onChange={(e) => updateProjectMeta({ strokeWidth: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
            </div>
          )}
          {(project.fontMode === "dot-matrix" || project.fontMode === "dot-single-path") && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Dot Spacing (font units)">
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={project.dotSpacing}
                    onChange={(e) => updateProjectMeta({ dotSpacing: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
                <Field label="Dot Radius (font units)">
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={project.dotRadius}
                    onChange={(e) => updateProjectMeta({ dotRadius: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
              </div>
              <button
                type="button"
                disabled={converting || drawnCount === 0}
                onClick={() => executeConvert(project.fontMode)}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                title="Re-sample all glyph dots using updated spacing and radius"
              >
                {converting ? <Loader2 size={12} className="animate-spin" /> : null}
                Re-apply Dot Settings to All Glyphs
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500">
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
