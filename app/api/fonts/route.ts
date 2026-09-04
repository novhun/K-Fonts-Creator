import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import opentype from "opentype.js";

// Supported font extensions
const FONT_EXTS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

// Root folder to scan — always the project-level `fonts/` directory
const FONTS_ROOT = path.join(process.cwd(), "fonts");

export interface FontVariantMeta {
  /** Relative path from FONTS_ROOT, used to build the serve URL */
  relativePath: string;
  fileName: string;
  familyName: string;
  subfamilyName: string;
  fullName: string;
  weight: number;
  italic: boolean;
  isVariable: boolean;
  ext: string;
  /** Size in bytes */
  size: number;
}

export type FontLanguage = "khmer" | "latin" | "khmer+latin" | "other";

export interface FontFamilyMeta {
  id: string;
  family: string;
  language: FontLanguage;
  /** The top-level folder this family lives under (relative to FONTS_ROOT) */
  folder: string;
  variants: FontVariantMeta[];
}

/** A folder node in the folder tree */
export interface FolderNode {
  /** Folder name (basename) */
  name: string;
  /** Relative path from FONTS_ROOT */
  relativePath: string;
  /** Direct child sub-folders */
  children: FolderNode[];
  /** Total number of font FILES directly and recursively in this folder */
  fontCount: number;
  /** Total bytes of all fonts under this folder */
  totalSize: number;
}

interface ParsedMeta {
  familyName: string;
  subfamilyName: string;
  fullName: string;
  weight: number;
  italic: boolean;
  isVariable: boolean;
  language: FontLanguage;
}

export interface FontsApiResponse {
  families: FontFamilyMeta[];
  folderTree: FolderNode[];
  /** Unique top-level folder names (direct children of fonts/) */
  topFolders: string[];
  scannedAt: string;
}

// ─── File walking ────────────────────────────────────────────────────────────

/** Walk a directory recursively and return all font file absolute paths */
function walkFonts(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFonts(full, results);
    } else if (FONT_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

/** Build a FolderNode tree for a given directory */
function buildFolderTree(dir: string, rootDir: string): FolderNode {
  const name = path.basename(dir);
  const relativePath = path.relative(rootDir, dir).replace(/\\/g, "/");
  const children: FolderNode[] = [];
  let fontCount = 0;
  let totalSize = 0;

  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const child = buildFolderTree(full, rootDir);
        children.push(child);
        fontCount += child.fontCount;
        totalSize += child.totalSize;
      } else if (FONT_EXTS.has(path.extname(entry.name).toLowerCase())) {
        fontCount++;
        try { totalSize += fs.statSync(full).size; } catch { /* ignore */ }
      }
    }
  }

  return { name, relativePath, children, fontCount, totalSize };
}

// ─── Font metadata ───────────────────────────────────────────────────────────

function guessStyleAndWeight(
  rawSubfamily: string,
  fullName: string,
  fileName: string
): { subfamilyName: string; weight: number; italic: boolean } {
  const combined = `${rawSubfamily} ${fullName} ${fileName}`.toLowerCase();
  const isItalic = /italic|oblique/i.test(combined);

  if (/black|heavy|\b900\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "Black Italic" : "Black", weight: 900, italic: isItalic };
  }
  if (/extrabold|extra bold|ultra bold|\b800\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "ExtraBold Italic" : "ExtraBold", weight: 800, italic: isItalic };
  }
  if (/semibold|semi bold|demi bold|demibold|\b600\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "SemiBold Italic" : "SemiBold", weight: 600, italic: isItalic };
  }
  if (/bold|\b700\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "Bold Italic" : "Bold", weight: 700, italic: isItalic };
  }
  if (/medium|\b500\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "Medium Italic" : "Medium", weight: 500, italic: isItalic };
  }
  if (/extralight|extra light|ultralight|ultra light|\b200\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "ExtraLight Italic" : "ExtraLight", weight: 200, italic: isItalic };
  }
  if (/light|\b300\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "Light Italic" : "Light", weight: 300, italic: isItalic };
  }
  if (/thin|hairline|\b100\b/i.test(combined)) {
    return { subfamilyName: isItalic ? "Thin Italic" : "Thin", weight: 100, italic: isItalic };
  }
  if (isItalic) {
    return { subfamilyName: "Italic", weight: 400, italic: true };
  }

  const cleanSub = rawSubfamily.trim();
  return {
    subfamilyName: cleanSub && cleanSub.toLowerCase() !== "regular" ? cleanSub : "Regular",
    weight: 400,
    italic: false,
  };
}

function detectLanguage(font: opentype.Font): FontLanguage {
  try {
    const cmap = (font.tables as Record<string, unknown>)["cmap"] as
      | { glyphIndexMap?: Record<number, number> }
      | undefined;
    const map = cmap?.glyphIndexMap ?? {};

    const hasKhmer = Object.keys(map).some((cp) => { const n = Number(cp); return n >= 0x1780 && n <= 0x17ff; });
    const hasLatin = Object.keys(map).some((cp) => { const n = Number(cp); return n >= 0x41 && n <= 0x7a; });

    if (hasKhmer && hasLatin) return "khmer+latin";
    if (hasKhmer) return "khmer";
    if (hasLatin) return "latin";
    return "other";
  } catch {
    return "other";
  }
}

function parseFontMeta(filePath: string): ParsedMeta | null {
  const fileName = path.basename(filePath, path.extname(filePath));
  try {
    const buffer = fs.readFileSync(filePath);
    const font = opentype.parse(buffer.buffer as ArrayBuffer);

    type NameRecord = { en?: string } | undefined;
    const n = font.names as unknown as Record<string, NameRecord>;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = n[k]?.en;
        if (v) return v;
      }
      return "";
    };

    const rawSubfamily = pick("preferredSubfamily", "fontSubfamily");
    const fullName = pick("fullName") || fileName;
    const styleInfo = guessStyleAndWeight(rawSubfamily, fullName, fileName);

    return {
      familyName: fileName,
      subfamilyName: styleInfo.subfamilyName,
      fullName,
      weight: styleInfo.weight,
      italic: styleInfo.italic,
      isVariable: "fvar" in font.tables || fileName.toLowerCase().includes("variable"),
      language: detectLanguage(font),
    };
  } catch {
    const styleInfo = guessStyleAndWeight("", fileName, fileName);
    return {
      familyName: fileName,
      subfamilyName: styleInfo.subfamilyName,
      fullName: fileName,
      weight: styleInfo.weight,
      italic: styleInfo.italic,
      isVariable: fileName.toLowerCase().includes("variable"),
      language: "other",
    };
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET() {
  if (!fs.existsSync(FONTS_ROOT)) {
    return NextResponse.json({
      families: [],
      folderTree: [],
      topFolders: [],
      scannedAt: new Date().toISOString(),
    } satisfies FontsApiResponse);
  }

  // Build folder tree (direct children of FONTS_ROOT)
  const topDirs = fs
    .readdirSync(FONTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const folderTree: FolderNode[] = topDirs.map((name) =>
    buildFolderTree(path.join(FONTS_ROOT, name), FONTS_ROOT)
  );

  // Also include loose fonts at the root level
  const rootFontFiles = fs
    .readdirSync(FONTS_ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && FONT_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(FONTS_ROOT, e.name));

  // Walk all fonts
  const allFontFiles = [...rootFontFiles, ...walkFonts(FONTS_ROOT).filter(
    (f) => !rootFontFiles.includes(f)
  )];

  const families: FontFamilyMeta[] = [];

  for (const filePath of allFontFiles) {
    const relativePath = path.relative(FONTS_ROOT, filePath).replace(/\\/g, "/");
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch { /* ignore */ }

    // Determine which top-level folder this file belongs to
    const parts = relativePath.split("/");
    const folder = parts.length > 1 ? parts[0] : "(root)";

    const meta = parseFontMeta(filePath);
    if (!meta) continue;

    const variant: FontVariantMeta = {
      relativePath,
      fileName,
      familyName: meta.familyName,
      subfamilyName: meta.subfamilyName,
      fullName: meta.fullName,
      weight: meta.weight,
      italic: meta.italic,
      isVariable: meta.isVariable,
      ext,
      size,
    };

    families.push({
      id: meta.familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      family: meta.familyName,
      language: meta.language,
      folder,
      variants: [variant],
    });
  }

  families.sort((a, b) => a.family.localeCompare(b.family));

  return NextResponse.json(
    {
      families,
      folderTree,
      topFolders: topDirs,
      scannedAt: new Date().toISOString(),
    } satisfies FontsApiResponse,
    { headers: { "Cache-Control": "no-store" } }
  );
}
