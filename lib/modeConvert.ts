import { DotType, FontMode, PathCommand } from "./types";
import { strokeToOutline } from "./strokeToOutline";
import { skeletonizeGlyph } from "./skeletonize";
import { glyphToDotMatrix, glyphToDotSinglePath, strokePathToDots } from "./dotMatrix";

export interface ModeConvertParams {
  strokeWidth?: number;
  dotSpacing?: number;
  dotRadius?: number;
  unitsPerEm?: number;
  dotType?: DotType;
}

/**
 * Converts a glyph path between glyph styles:
 * - outline: filled contours
 * - single-line: open centerline strokes
 * - dot-matrix: 2D grid matrix of dots
 * - dot-single-path: equidistant dots placed along the single centerline stroke
 */
export function convertGlyphPath(
  path: PathCommand[],
  from: FontMode,
  to: FontMode,
  params: ModeConvertParams
): PathCommand[] {
  if (from === to || path.length === 0) return path;

  const upe = params.unitsPerEm || 1000;
  const strokeW = params.strokeWidth || Math.round(upe * 0.04);
  const dotSpacing = params.dotSpacing || Math.round(upe * 0.045);
  const dotRadius = params.dotRadius || Math.max(1, Math.round(dotSpacing * 0.38));

  // Converting TO dot-single-path (school tracing style)
  if (to === "dot-single-path") {
    if (from === "single-line") {
      return strokePathToDots(path, dotSpacing, dotRadius, upe);
    }
    return glyphToDotSinglePath(path, dotSpacing, dotRadius, upe);
  }

  // Converting TO dot-matrix
  if (to === "dot-matrix") {
    if (params.dotType === "single-path" || from === "single-line") {
      return from === "single-line"
        ? strokePathToDots(path, dotSpacing, dotRadius, upe)
        : glyphToDotSinglePath(path, dotSpacing, dotRadius, upe);
    }
    const filled = path;
    return glyphToDotMatrix(filled, dotSpacing, dotRadius, upe);
  }

  // Converting TO single-line
  if (to === "single-line") {
    return skeletonizeGlyph(path);
  }

  // Converting TO outline
  if (to === "outline") {
    if (from === "single-line") {
      return strokeToOutline(path, strokeW);
    }
    // dot-matrix and dot-single-path are already closed circle outlines
    return path;
  }

  return path;
}
