import { FontProject, GlyphRecord } from "./types";
import { buildOpentypeFont } from "./fontExport";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Builds a temporary font (drawn glyphs + .notdef) and returns a data: URL
 * suitable for an @font-face src, for live preview only. Not the export path.
 */
export function buildPreviewFontDataUrl(project: FontProject, glyphs: GlyphRecord[]): string | null {
  const hasDrawn = glyphs.some((g) => g.path.length > 0);
  if (!hasDrawn) return null;

  // When project has a preserved GSUB table, keep all glyphs so lookup indices match.
  // For other projects, keep glyphs that have path content or valid advance width (e.g. space).
  const relevantGlyphs = project.gsubTable
    ? glyphs
    : glyphs.filter((g) => g.path.length > 0 || g.advanceWidth > 0);

  try {
    const font = buildOpentypeFont(project, relevantGlyphs);
    const buffer = font.toArrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    return `data:font/ttf;base64,${base64}`;
  } catch (e) {
    console.error("Failed to build preview font", e);
    return null;
  }
}
