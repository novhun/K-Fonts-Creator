"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { UNICODE_GROUPS } from "@/lib/unicodeRanges";
import { boundingBox, isGlyphDrawn, pathToSvgD } from "@/lib/glyphPath";
import { PathCommand } from "@/lib/types";
import { Search } from "lucide-react";

function GlyphThumb({
  path,
  unitsPerEm,
  strokeMode,
  strokeWidth,
}: {
  path: PathCommand[];
  unitsPerEm: number;
  strokeMode: boolean;
  strokeWidth: number;
}) {
  const hasContent = path.length > 0;
  const bbox = boundingBox(path);
  const extra = strokeMode ? strokeWidth : 0;
  const w = hasContent ? Math.max(bbox.maxX - bbox.minX + extra, 1) : unitsPerEm;
  const h = hasContent ? Math.max(bbox.maxY - bbox.minY + extra, 1) : unitsPerEm;
  const padX = w * 0.18;
  const padY = h * 0.18;
  const vbX = (hasContent ? bbox.minX - extra / 2 : 0) - padX;
  const vbYsvg = (hasContent ? -bbox.maxY - extra / 2 : -unitsPerEm) - padY;
  const vbW = w + 2 * padX;
  const vbH = h + 2 * padY;
  return (
    <svg viewBox={`${vbX} ${vbYsvg} ${vbW} ${vbH}`} className="h-5 w-5">
      <g transform="scale(1,-1)">
        {strokeMode ? (
          <path d={pathToSvgD(path)} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d={pathToSvgD(path)} fill="currentColor" />
        )}
      </g>
    </svg>
  );
}

export default function GlyphGrid() {
  const project = useProjectStore((s) => s.project);
  const glyphs = useProjectStore((s) => s.glyphs);
  const currentHex = useProjectStore((s) => s.currentHex);
  const selectGlyph = useProjectStore((s) => s.selectGlyph);
  const [query, setQuery] = useState("");

  if (!project) return null;
  const defaultAdvance = Math.round(project.unitsPerEm * 0.6);
  const q = query.trim().toLowerCase();

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#101217]">
      <div className="border-b border-slate-200 p-2 dark:border-white/10">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search glyphs, e.g. 1780 or ក"
            className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-black/30 dark:text-white/80 dark:focus:border-sky-500/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {UNICODE_GROUPS.map((group) => {
          const filtered = q
            ? group.chars.filter(
                (c) => c.char.toLowerCase() === q || c.hex.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
              )
            : group.chars;
          if (filtered.length === 0) return null;
          const drawnCount = group.chars.filter((c) => isGlyphDrawn(glyphs[c.hex])).length;
          return (
            <div key={group.id} className="mb-3">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/40">{group.label}</h3>
                <span className="text-[10px] tabular-nums text-slate-400 dark:text-white/25">
                  {drawnCount}/{group.chars.length}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {filtered.map((c) => {
                  const g = glyphs[c.hex];
                  const drawn = isGlyphDrawn(g);
                  const active = currentHex === c.hex;
                  return (
                    <button
                      key={c.hex}
                      title={`${c.hex.startsWith("17D2_") ? c.hex : `U+${c.hex}`} · ${c.name}${drawn ? " · drawn" : " · not drawn"}`}
                      onClick={() => selectGlyph(c.hex, c.isSubscript ? 0 : defaultAdvance)}
                      className={`relative flex aspect-square items-center justify-center rounded-md border text-base transition ${
                        active
                          ? "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                          : drawn
                          ? "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/90 dark:hover:border-white/25 dark:hover:bg-white/[0.09]"
                          : "border-slate-100 bg-slate-50/50 text-slate-400 hover:border-slate-200 hover:bg-slate-100/60 dark:border-white/5 dark:bg-white/[0.02] dark:text-white/40 dark:hover:border-white/15 dark:hover:bg-white/[0.06]"
                      }`}
                    >
                      {drawn && g ? (
                        <GlyphThumb
                          path={g.path}
                          unitsPerEm={project.unitsPerEm}
                          strokeMode={project.fontMode === "single-line"}
                          strokeWidth={project.strokeWidth}
                        />
                      ) : (
                        <span>{c.char}</span>
                      )}
                      <span
                        className={`absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${
                          drawn ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/15"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
