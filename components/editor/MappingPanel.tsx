"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { findUnicodeChar } from "@/lib/unicodeRanges";
import { boundingBox, translatePath } from "@/lib/glyphPath";
import { glyphToDotMatrix, glyphToDotSinglePath } from "@/lib/dotMatrix";
import { Field, inputClass } from "@/components/ui/Field";
import { Hash } from "lucide-react";

export default function MappingPanel() {
  const project = useProjectStore((s) => s.project);
  const currentHex = useProjectStore((s) => s.currentHex);
  const glyphs = useProjectStore((s) => s.glyphs);
  const selectGlyph = useProjectStore((s) => s.selectGlyph);
  const updateGlyphMeta = useProjectStore((s) => s.updateGlyphMeta);
  const updateGlyphPath = useProjectStore((s) => s.updateGlyphPath);

  const glyph = currentHex ? glyphs[currentHex] : undefined;
  const [hexInput, setHexInput] = useState(currentHex ?? "");
  const [hexError, setHexError] = useState<string | null>(null);

  useEffect(() => {
    setHexInput(currentHex ?? "");
    setHexError(null);
  }, [currentHex]);

  if (!project) return null;

  if (!glyph || !currentHex) {
    return (
      <div className="border-b border-white/10 p-4 text-xs text-white/30">
        Select a glyph to view its Unicode mapping and metrics.
      </div>
    );
  }

  const uc = findUnicodeChar(currentHex);
  const bbox = boundingBox(glyph.path);
  const glyphWidth = glyph.path.length > 0 ? Math.max(0, bbox.maxX - bbox.minX) : 0;
  const rsb = Math.round(glyph.advanceWidth - glyph.leftSideBearing - glyphWidth);

  function jumpToHex() {
    if (!project) return;
    const clean = hexInput.trim().replace(/^u\+/i, "").toUpperCase();
    const found = findUnicodeChar(clean);
    if (!found) {
      setHexError("Not in the supported Basic Latin / Khmer ranges");
      return;
    }
    setHexError(null);
    selectGlyph(found.hex, found.isSubscript ? 0 : Math.round(project.unitsPerEm * 0.6));
  }

  function setLeftSideBearing(newLsb: number) {
    if (!currentHex || !glyph) return;
    const delta = newLsb - (glyph.path.length > 0 ? bbox.minX : 0);
    if (glyph.path.length > 0 && delta !== 0) {
      updateGlyphPath(currentHex, translatePath(glyph.path, delta, 0));
    }
    updateGlyphMeta(currentHex, { leftSideBearing: newLsb });
  }

  function setRightSideBearing(newRsb: number) {
    if (!currentHex || !glyph) return;
    const newAdvance = Math.round(glyph.leftSideBearing + glyphWidth + newRsb);
    updateGlyphMeta(currentHex, { advanceWidth: Math.max(0, newAdvance) });
  }

  return (
    <div className="space-y-3 border-b border-white/10 p-3">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        <Hash size={12} />
        Unicode &amp; Metrics
      </h2>

      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/5 text-xl text-white/90">
          {uc?.char}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white/80">{uc?.name || glyph.name}</p>
          <p className="text-[11px] text-white/35">{glyph.name}</p>
        </div>
      </div>

      <Field label={uc?.isSubscript ? "Subscript / Glyph ID" : "Unicode Code Point"}>
        <div className="flex gap-1.5">
          <div className="flex flex-1 items-center rounded-md border border-white/10 bg-black/30 focus-within:border-sky-500/60">
            <span className="pl-2 text-xs text-white/30">{uc?.isSubscript ? "" : "U+"}</span>
            <input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && jumpToHex()}
              onBlur={jumpToHex}
              className="w-full bg-transparent px-1 py-1.5 text-sm uppercase text-white/90 outline-none"
            />
          </div>
        </div>
        {hexError && <p className="mt-1 text-[11px] text-red-400">{hexError}</p>}
      </Field>

      <Field label="Glyph Name">
        <input
          className={inputClass}
          value={glyph.name}
          onChange={(e) => updateGlyphMeta(currentHex, { name: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Advance Width">
          <input
            type="number"
            className={inputClass}
            value={glyph.advanceWidth}
            onChange={(e) => updateGlyphMeta(currentHex, { advanceWidth: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Glyph Width">
          <input type="number" disabled className={`${inputClass} opacity-50`} value={Math.round(glyphWidth)} />
        </Field>
        <Field label="Left Side Bearing">
          <input
            type="number"
            className={inputClass}
            value={glyph.leftSideBearing}
            onChange={(e) => setLeftSideBearing(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Right Side Bearing">
          <input
            type="number"
            className={inputClass}
            value={rsb}
            onChange={(e) => setRightSideBearing(Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      {glyph.path.length > 0 && (
        <div className="border-t border-white/10 pt-2.5 space-y-1.5">
          <p className="text-[10px] uppercase font-semibold text-white/40 tracking-wider">Glyph Style Actions</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const upe = project.unitsPerEm || 1000;
                const dotSpacing = project.dotSpacing || Math.round(upe * 0.045);
                const dotRadius = project.dotRadius || Math.max(1, Math.round(dotSpacing * 0.38));
                const dotted = glyphToDotSinglePath(glyph.path, dotSpacing, dotRadius, upe);
                if (dotted.length > 0) updateGlyphPath(currentHex, dotted);
              }}
              className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-[11px] font-medium text-white/80 hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300"
              title="Convert this glyph to equidistant dots along its single centerline path"
            >
              Dot Single Path
            </button>
            <button
              type="button"
              onClick={() => {
                const upe = project.unitsPerEm || 1000;
                const dotSpacing = project.dotSpacing || Math.round(upe * 0.045);
                const dotRadius = project.dotRadius || Math.max(1, Math.round(dotSpacing * 0.38));
                const dotted = glyphToDotMatrix(glyph.path, dotSpacing, dotRadius, upe);
                if (dotted.length > 0) updateGlyphPath(currentHex, dotted);
              }}
              className="flex-1 rounded-md border border-white/10 bg-white/5 py-1 text-[11px] font-medium text-white/80 hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-300"
              title="Convert this glyph to a 2D dot grid matrix"
            >
              Dot Grid
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
