"use client";

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { buildPreviewFontDataUrl } from "@/lib/fontPreview";
import { Eye } from "lucide-react";

export default function PreviewPanel() {
  const project = useProjectStore((s) => s.project);
  const glyphs = useProjectStore((s) => s.glyphs);
  const [text, setText] = useState("Hello កម្ពុជា");
  const [fontUrl, setFontUrl] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(48);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const familyName = project ? `kfc-preview-${project.id}` : "kfc-preview";

  useEffect(() => {
    if (!project) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFontUrl(buildPreviewFontDataUrl(project, Object.values(glyphs)));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [project, glyphs]);

  if (!project) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        <Eye size={12} />
        Live Preview
      </h2>

      {fontUrl && <style>{`@font-face { font-family: '${familyName}'; src: url(${fontUrl}); }`}</style>}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mb-2 w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 text-sm text-white/90 outline-none focus:border-sky-500/50"
        placeholder="Type to preview… (e.g. Hello, or Khmer text)"
      />

      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] text-white/40">Size</span>
        <input
          type="range"
          min={16}
          max={120}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-8 text-right text-[11px] tabular-nums text-white/40">{fontSize}</span>
      </div>

      <div className="min-h-[140px] flex-1 overflow-auto rounded-md border border-white/10 bg-white p-3">
        {fontUrl ? (
          <p style={{ fontFamily: `'${familyName}'`, fontSize, lineHeight: 1.4, color: "#111", wordBreak: "break-word" }}>
            {text || " "}
          </p>
        ) : (
          <p className="text-sm text-black/40">Draw at least one glyph to see a live preview here.</p>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-snug text-white/40">
        Khmer OpenType layout (GSUB) is active: subscript stacking (ជើង) via the COENG sign (្)
        and below-base ligatures are automatically shaped in preview and export.
      </p>
    </div>
  );
}
