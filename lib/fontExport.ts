import opentype from "opentype.js";
import { FontProject, GlyphRecord } from "./types";
import { sfntToWoff } from "./woffPack";
import { convertGlyphPath } from "./modeConvert";

/**
 * opentype.js always serializes `Font.toArrayBuffer()` as a CFF-flavored
 * OpenType font ('OTTO'), which natively supports the cubic bezier curves
 * our editor produces (it even auto-converts quadratics), so glyph paths are
 * passed through untouched here for full fidelity.
 *
 * Outline and dot-matrix glyphs are already filled shapes and pass straight
 * through. "single-line" glyphs are authored as open centerline strokes —
 * text rendering is always fill-based, so those get expanded into a thin
 * filled outline here (export/preview time only; the stored glyph path
 * stays the simple editable centerline).
 */
/**
 * Synthesizes an OpenType GSUB table for Khmer subjoined consonants
 * (features: blwf, pref, liga) for script tags khmr, khm2, and DFLT.
 */
export function generateKhmerGsub(fontGlyphs: opentype.Glyph[]): any {
  let coengIdx = -1;
  for (let i = 0; i < fontGlyphs.length; i++) {
    const g = fontGlyphs[i];
    if (g.unicode === 0x17d2 || g.name === "uni17D2") {
      coengIdx = i;
      break;
    }
  }
  if (coengIdx === -1) return null;

  const blwfLigs: Array<{ ligGlyph: number; components: number[] }> = [];
  const prefLigs: Array<{ ligGlyph: number; components: number[] }> = [];

  for (let i = 0; i < fontGlyphs.length; i++) {
    const g = fontGlyphs[i];
    const gName = g.name || "";
    let targetConsonantCp: number | null = null;
    const m = gName.match(/^(?:uni)?17D2_?([0-9A-Fa-f]{4})/i) || gName.match(/^coeng_?([0-9A-Fa-f]{4})/i);
    if (m) {
      targetConsonantCp = parseInt(m[1], 16);
    }
    if (targetConsonantCp) {
      let compIdx = -1;
      for (let j = 0; j < fontGlyphs.length; j++) {
        if (fontGlyphs[j].unicode === targetConsonantCp) {
          compIdx = j;
          break;
        }
      }
      if (compIdx !== -1) {
        if (targetConsonantCp === 0x179a) {
          prefLigs.push({ ligGlyph: i, components: [compIdx] });
        } else {
          blwfLigs.push({ ligGlyph: i, components: [compIdx] });
        }
      }
    }
  }

  if (blwfLigs.length === 0 && prefLigs.length === 0) return null;

  const lookups: any[] = [];
  const features: any[] = [];
  let lookupIdx = 0;

  if (blwfLigs.length > 0) {
    lookups.push({
      lookupType: 4,
      lookupFlag: 0,
      subtables: [
        {
          substFormat: 1,
          coverage: { format: 1, glyphs: [coengIdx] },
          ligatureSets: [blwfLigs],
        },
      ],
    });
    features.push({
      tag: "blwf",
      feature: { featureParams: 0, lookupListIndexes: [lookupIdx++] },
    });
  }

  if (prefLigs.length > 0) {
    lookups.push({
      lookupType: 4,
      lookupFlag: 0,
      subtables: [
        {
          substFormat: 1,
          coverage: { format: 1, glyphs: [coengIdx] },
          ligatureSets: [prefLigs],
        },
      ],
    });
    features.push({
      tag: "pref",
      feature: { featureParams: 0, lookupListIndexes: [lookupIdx++] },
    });
  }

  const allLookupIndices = lookups.map((_, idx) => idx);
  features.push({
    tag: "liga",
    feature: { featureParams: 0, lookupListIndexes: allLookupIndices },
  });

  const featureIndexes = features.map((_, idx) => idx);
  const langSys = { reqFeatureIndex: 65535, featureIndexes };

  return {
    version: 1,
    scripts: [
      { tag: "DFLT", script: { defaultLangSys: langSys, langSysRecords: [] } },
      { tag: "khmr", script: { defaultLangSys: langSys, langSysRecords: [] } },
      { tag: "khm2", script: { defaultLangSys: langSys, langSysRecords: [] } },
    ],
    features,
    lookups,
  };
}

function buildOpentypeGlyph(glyph: GlyphRecord, project: FontProject): opentype.Glyph {
  const path = convertGlyphPath(glyph.path, project.fontMode, "outline", project);
  const otPath = new opentype.Path();
  otPath.commands = path.map((c) => ({ ...c })) as unknown as opentype.PathCommand[];
  const isHexCodepoint = /^[0-9A-Fa-f]{4,6}$/.test(glyph.unicode);
  const unicode = isHexCodepoint ? parseInt(glyph.unicode, 16) : undefined;
  return new opentype.Glyph({
    name: glyph.name,
    unicode,
    advanceWidth: glyph.advanceWidth,
    path: otPath,
  });
}

export function buildOpentypeFont(project: FontProject, glyphs: GlyphRecord[]): opentype.Font {
  const hasNotdef = glyphs.some((g) => g.name === ".notdef" || g.glyphIndex === 0);
  const notdefPath = new opentype.Path();
  const defaultNotdef = new opentype.Glyph({
    name: ".notdef",
    advanceWidth: Math.round(project.unitsPerEm / 2),
    path: notdefPath,
  });

  const sorted = [...glyphs].sort((a, b) => {
    if (a.glyphIndex !== undefined && b.glyphIndex !== undefined) {
      return a.glyphIndex - b.glyphIndex;
    }
    const aIsHex = /^[0-9A-Fa-f]{4,6}$/.test(a.unicode);
    const bIsHex = /^[0-9A-Fa-f]{4,6}$/.test(b.unicode);
    if (aIsHex && bIsHex) {
      return parseInt(a.unicode, 16) - parseInt(b.unicode, 16);
    }
    if (aIsHex) return -1;
    if (bIsHex) return 1;
    return a.name.localeCompare(b.name);
  });

  const otGlyphs = hasNotdef
    ? sorted.map((g) => buildOpentypeGlyph(g, project))
    : [defaultNotdef, ...sorted.map((g) => buildOpentypeGlyph(g, project))];

  const font = new opentype.Font({
    familyName: project.name || "Untitled",
    styleName: "Regular",
    unitsPerEm: project.unitsPerEm,
    ascender: project.ascender,
    descender: project.descender,
    glyphs: otGlyphs,
  });

  if (project.gsubTable) {
    font.tables.gsub = JSON.parse(JSON.stringify(project.gsubTable));
  } else {
    const synthGsub = generateKhmerGsub(otGlyphs);
    if (synthGsub) {
      font.tables.gsub = synthGsub;
    }
  }

  return font;
}

/** Raw sfnt binary produced by opentype.js — CFF-flavored OpenType (.otf). */
export function exportOTFBuffer(project: FontProject, glyphs: GlyphRecord[]): ArrayBuffer {
  const font = buildOpentypeFont(project, glyphs);
  return font.toArrayBuffer();
}

export async function exportWOFFBuffer(project: FontProject, glyphs: GlyphRecord[]): Promise<ArrayBuffer> {
  const otf = exportOTFBuffer(project, glyphs);
  return sfntToWoff(otf);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function exportWOFF2Buffer(project: FontProject, glyphs: GlyphRecord[]): Promise<ArrayBuffer> {
  const otf = exportOTFBuffer(project, glyphs);
  // The wawoff2 WASM module can hang during init in some sandboxed browser
  // environments instead of rejecting, so guard it with a hard timeout —
  // callers should fall back to suggesting WOFF/OTF instead.
  const wawoff2 = await withTimeout(
    import("wawoff2"),
    8000,
    "WOFF2 isn't available in this browser — try WOFF or OTF instead."
  );
  const compressed = await withTimeout(
    wawoff2.compress(new Uint8Array(otf)),
    8000,
    "WOFF2 compression timed out — try WOFF or OTF instead."
  );
  const view = compressed as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

export function downloadArrayBuffer(buffer: ArrayBuffer, filename: string, mime: string) {
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ExportFormat = "otf" | "woff" | "woff2";

export async function exportFont(project: FontProject, glyphs: GlyphRecord[], format: ExportFormat) {
  const safeName = (project.name || "font").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
  if (format === "otf") {
    const buf = exportOTFBuffer(project, glyphs);
    downloadArrayBuffer(buf, `${safeName}.otf`, "font/otf");
  } else if (format === "woff") {
    const buf = await exportWOFFBuffer(project, glyphs);
    downloadArrayBuffer(buf, `${safeName}.woff`, "font/woff");
  } else {
    const buf = await exportWOFF2Buffer(project, glyphs);
    downloadArrayBuffer(buf, `${safeName}.woff2`, "font/woff2");
  }
}
