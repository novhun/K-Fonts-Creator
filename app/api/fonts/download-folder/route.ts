import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FONTS_ROOT = path.join(process.cwd(), "fonts");
const FONT_EXTS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

function walkFonts(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFonts(full, results);
    else if (FONT_EXTS.has(path.extname(entry.name).toLowerCase())) results.push(full);
  }
  return results;
}

/**
 * GET /api/fonts/download-folder?folder=EnglishFonts
 *
 * Returns a plain text manifest of download URLs for every font file
 * in the requested sub-folder. The browser page triggers individual
 * <a download> clicks from this list.
 *
 * (A true ZIP would require an extra npm package; this approach is
 *  zero-dependency and works great for the browser-trigger pattern.)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folderParam = searchParams.get("folder") ?? "";

  // Security: no path traversal
  const resolved = path.resolve(FONTS_ROOT, folderParam);
  if (!resolved.startsWith(FONTS_ROOT)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const fontFiles = walkFonts(resolved);

  const files = fontFiles.map((f) => ({
    relativePath: path.relative(FONTS_ROOT, f).replace(/\\/g, "/"),
    fileName: path.basename(f),
    size: fs.statSync(f).size,
  }));

  return NextResponse.json({ folder: folderParam, files }, { headers: { "Cache-Control": "no-store" } });
}
