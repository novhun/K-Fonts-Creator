export type FontMode = "outline" | "single-line" | "dot-matrix" | "dot-single-path";
export type DotType = "grid" | "single-path";

export interface FontProject {
  id: string;
  name: string;
  author: string;
  version: string;
  unitsPerEm: number;
  ascender: number;
  descender: number; // stored negative
  capHeight: number;
  xHeight: number;
  fontMode: FontMode;
  /** Stroke thickness in font units, used only when fontMode is "single-line". */
  strokeWidth: number;
  /** Grid spacing and dot radius in font units, used when fontMode is "dot-matrix" or "dot-single-path". */
  dotSpacing: number;
  dotRadius: number;
  /** Specific dot distribution pattern ("grid" for 2D mesh, "single-path" for dots along stroke) */
  dotType?: DotType;
  createdAt: number;
  updatedAt: number;
  /** Preserved or generated OpenType GSUB layout table */
  gsubTable?: any;
}

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "Z" };

export interface GlyphRecord {
  id: string; // `${projectId}::${unicodeHex}`
  projectId: string;
  unicode: string; // uppercase hex string, e.g. "0041", "1780", or "17D2_1780"
  name: string; // e.g. "uni0041"
  advanceWidth: number;
  leftSideBearing: number;
  path: PathCommand[];
  updatedAt: number;
  glyphIndex?: number;
}

export interface UnicodeChar {
  codepoint?: number;
  hex: string; // uppercase hex, e.g. "1780" or "17D2_1780"
  char: string;
  name: string;
  isSubscript?: boolean;
  baseCodepoint?: number;
}

export interface UnicodeGroup {
  id: string;
  label: string;
  chars: UnicodeChar[];
}

export type ToolId =
  | "select"
  | "pen"
  | "pen-line"
  | "pen-curve"
  | "shape-rect"
  | "shape-circle"
  | "shape-triangle"
  | "shape-line"
  | "eraser"
  | "pan";

