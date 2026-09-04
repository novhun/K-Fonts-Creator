import opentype from "opentype.js";
import { FontProject, GlyphRecord, PathCommand } from "./types";
import { ALL_UNICODE_CHARS } from "./unicodeRanges";
import { makeGlyphId } from "./glyphPath";

export interface ImportResult {
  project: FontProject;
  glyphs: GlyphRecord[];
  importedCount: number;
  skippedCount: number;
}

const SUPPORTED_CODEPOINTS = new Set(
  ALL_UNICODE_CHARS.map((c) => c.codepoint).filter((cp): cp is number => typeof cp === "number")
);

function getCoverageGlyphIndex(coverage: any, targetGlyphIdx: number): number {
  if (!coverage) return -1;
  if (Array.isArray(coverage.glyphs)) {
    return coverage.glyphs.indexOf(targetGlyphIdx);
  }
  if (Array.isArray(coverage.ranges)) {
    let acc = 0;
    for (const r of coverage.ranges) {
      if (targetGlyphIdx >= r.start && targetGlyphIdx <= r.end) {
        return acc + (targetGlyphIdx - r.start);
      }
      acc += r.end - r.start + 1;
    }
  }
  return -1;
}

function extractCoengMap(font: opentype.Font): Map<number, string> {
  const map = new Map<number, string>(); // glyphIndex -> "17D2_XXXX"

  // 1. Check by glyph name patterns
  for (let i = 0; i < font.glyphs.length; i++) {
    const g = font.glyphs.get(i);
    const gName = g.name || "";
    const m = gName.match(/^(?:uni)?17D2_?([0-9A-Fa-f]{4})$/i) || gName.match(/^coeng_?([0-9A-Fa-f]{4})$/i);
    if (m) {
      map.set(i, `17D2_${m[1].toUpperCase()}`);
    }
  }

  // 2. Extract from GSUB ligatures under U+17D2 (Coeng)
  const gsub = (font.tables as Record<string, any>)?.gsub;
  if (gsub && Array.isArray(gsub.lookups)) {
    let coengGlyphIdx = -1;
    for (let i = 0; i < font.glyphs.length; i++) {
      const g = font.glyphs.get(i);
      if (g.unicode === 0x17D2 || (g.unicodes && g.unicodes.includes(0x17D2))) {
        coengGlyphIdx = i;
        break;
      }
    }
    if (coengGlyphIdx !== -1) {
      for (const lookup of gsub.lookups) {
        if (lookup.lookupType === 4 && Array.isArray(lookup.subtables)) {
          for (const st of lookup.subtables) {
            if (st.coverage && Array.isArray(st.ligatureSets)) {
              const covIndex = getCoverageGlyphIndex(st.coverage, coengGlyphIdx);
              if (covIndex !== -1) {
                const ligSet = st.ligatureSets[covIndex] || [];
                for (const lig of ligSet) {
                  if (lig.components && lig.components.length === 1) {
                    const compGlyph = font.glyphs.get(lig.components[0]);
                    const compCp = compGlyph.unicode || (compGlyph.unicodes && compGlyph.unicodes[0]);
                    if (compCp && compCp >= 0x1780 && compCp <= 0x17a2) {
                      const hex = compCp.toString(16).toUpperCase().padStart(4, "0");
                      map.set(lig.ligGlyph, `17D2_${hex}`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return map;
}

export async function importFontFile(file: File, projectId: string): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const font = opentype.parse(buffer);

  const unitsPerEm = font.unitsPerEm || 1000;
  const ascender = font.ascender ?? Math.round(unitsPerEm * 0.8);
  const descender = font.descender ?? -Math.round(unitsPerEm * 0.2);
  const os2 = (font.tables as Record<string, any>)?.os2;
  const capHeight = os2?.sCapHeight || Math.round(unitsPerEm * 0.7);
  const xHeight = os2?.sxHeight || Math.round(unitsPerEm * 0.5);

  const now = Date.now();
  const project: FontProject = {
    id: projectId,
    name: font.names?.fontFamily?.en || file.name.replace(/\.[^.]+$/, ""),
    author: font.names?.designer?.en || "",
    version: font.names?.version?.en?.replace(/^Version\s*/i, "") || "1.0.0",
    unitsPerEm,
    ascender,
    descender,
    capHeight,
    xHeight,
    fontMode: "outline",
    strokeWidth: Math.round(unitsPerEm * 0.04),
    dotSpacing: Math.round(unitsPerEm * 0.045),
    dotRadius: Math.round(unitsPerEm * 0.012),
    createdAt: now,
    updatedAt: now,
    gsubTable: (font.tables as Record<string, any>)?.gsub
      ? JSON.parse(JSON.stringify((font.tables as Record<string, any>).gsub))
      : undefined,
  };

  const coengMap = extractCoengMap(font);
  const glyphs: GlyphRecord[] = [];
  let importedCount = 0;
  let skippedCount = 0;
  const numGlyphs = font.glyphs.length;

  for (let i = 0; i < numGlyphs; i++) {
    const g = font.glyphs.get(i);
    const unicodes: number[] =
      g.unicodes && g.unicodes.length ? g.unicodes : g.unicode !== undefined ? [g.unicode] : [];
    const commands = (g.path?.commands || []) as PathCommand[];

    if (unicodes.length > 0) {
      for (const cp of unicodes) {
        const hex = cp.toString(16).toUpperCase().padStart(4, "0");
        glyphs.push({
          id: makeGlyphId(projectId, hex),
          projectId,
          unicode: hex,
          name: g.name || `uni${hex}`,
          advanceWidth: g.advanceWidth ?? Math.round(unitsPerEm * 0.5),
          leftSideBearing: g.leftSideBearing ?? 0,
          path: commands.map((c) => ({ ...c })),
          updatedAt: now,
          glyphIndex: i,
        });
        if (SUPPORTED_CODEPOINTS.has(cp)) {
          importedCount++;
        }
      }
    } else {
      // Unencoded glyph (e.g. subjoined consonant, ligature, or alternate)
      const coengKey = coengMap.get(i);
      const key = coengKey || g.name || `glyph_${i}`;
      glyphs.push({
        id: makeGlyphId(projectId, key),
        projectId,
        unicode: key,
        name: g.name || key,
        advanceWidth: g.advanceWidth ?? 0,
        leftSideBearing: g.leftSideBearing ?? 0,
        path: commands.map((c) => ({ ...c })),
        updatedAt: now,
        glyphIndex: i,
      });
      if (coengKey) {
        importedCount++;
      }
    }
  }

  return { project, glyphs, importedCount, skippedCount };
}
