import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FONTS_ROOT = path.join(process.cwd(), "fonts");

const MIME: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  // Reconstruct the relative path from slug segments
  const relative = params.slug.map(decodeURIComponent).join("/");

  // Security: prevent path traversal
  const resolved = path.resolve(FONTS_ROOT, relative);
  if (!resolved.startsWith(FONTS_ROOT)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const buffer = fs.readFileSync(resolved);
  const fileName = path.basename(resolved);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${fileName}"`,
      // Allow browser font loading
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
