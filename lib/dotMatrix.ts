import { PathCommand } from "./types";
import { boundingBox } from "./glyphPath";
import { skeletonizeGlyph } from "./skeletonize";

const KAPPA = 0.5522847498307936; // standard cubic-bezier circle approximation constant

/**
 * Clockwise circular contour in font space (where Y points up).
 * PostScript/CFF outlines require outer paths to be clockwise to fill solidly.
 */
function circlePath(cx: number, cy: number, r: number): PathCommand[] {
  const k = r * KAPPA;
  return [
    { type: "M", x: cx + r, y: cy },
    { type: "C", x1: cx + r, y1: cy - k, x2: cx + k, y2: cy - r, x: cx, y: cy - r },
    { type: "C", x1: cx - k, y1: cy - r, x2: cx - r, y2: cy - k, x: cx - r, y: cy },
    { type: "C", x1: cx - r, y1: cy + k, x2: cx - k, y2: cy + r, x: cx, y: cy + r },
    { type: "C", x1: cx + k, y1: cy + r, x2: cx + r, y2: cy + k, x: cx + r, y: cy },
    { type: "Z" },
  ];
}

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

/**
 * Converts a filled glyph outline into a dot-matrix pattern — a grid of
 * round dots sampled wherever the grid cell falls inside the shape —
 * in the style of fonts like "Doto" or "Open Khmer School Dotted".
 */
export function glyphToDotMatrix(
  path: PathCommand[],
  spacing?: number,
  dotRadius?: number,
  unitsPerEm = 1000
): PathCommand[] {
  if (path.length === 0) return [];
  const s = spacing && spacing > 0 && !isNaN(spacing) ? spacing : Math.round(unitsPerEm * 0.045);
  const r =
    dotRadius && dotRadius > 0 && !isNaN(dotRadius)
      ? dotRadius
      : Math.max(1, Math.round(s * 0.38));

  const bbox = boundingBox(path);
  const bboxW = bbox.maxX - bbox.minX;
  const bboxH = bbox.maxY - bbox.minY;
  if (bboxW <= 0 || bboxH <= 0) return [];

  // Align grid to global font coordinate grid (anchored at origin 0, 0):
  const startX = Math.floor(bbox.minX / s) * s;
  const endX = Math.ceil(bbox.maxX / s) * s;
  const startY = Math.floor(bbox.minY / s) * s;
  const endY = Math.ceil(bbox.maxY / s) * s;

  const totalW = endX - startX;
  const totalH = endY - startY;
  if (totalW <= 0 || totalH <= 0) return [];

  const cols = Math.max(1, Math.round(totalW / s));
  const rows = Math.max(1, Math.round(totalH / s));

  // Use 2x supersampling for high sensitivity and crisp detection of thin Khmer strokes
  const scale = 2;
  const canvasW = cols * scale;
  const canvasH = rows * scale;

  if (typeof document === "undefined") return [];

  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }
  if (sharedCanvas.width < canvasW || sharedCanvas.height < canvasH) {
    sharedCanvas.width = Math.max(sharedCanvas.width, canvasW);
    sharedCanvas.height = Math.max(sharedCanvas.height, canvasH);
    sharedCtx = sharedCanvas.getContext("2d", { willReadFrequently: true });
  } else if (!sharedCtx) {
    sharedCtx = sharedCanvas.getContext("2d", { willReadFrequently: true });
  }

  const ctx = sharedCtx;
  if (!ctx) return [];

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = "#000";

  const toPixel = (p: { x: number; y: number }) => ({
    x: ((p.x - startX) / totalW) * canvasW,
    y: ((endY - p.y) / totalH) * canvasH,
  });

  ctx.beginPath();
  for (const cmd of path) {
    if (cmd.type === "M") {
      const p = toPixel(cmd);
      ctx.moveTo(p.x, p.y);
    } else if (cmd.type === "L") {
      const p = toPixel(cmd);
      ctx.lineTo(p.x, p.y);
    } else if (cmd.type === "C") {
      const p1 = toPixel({ x: cmd.x1, y: cmd.y1 });
      const p2 = toPixel({ x: cmd.x2, y: cmd.y2 });
      const p3 = toPixel(cmd);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    } else if (cmd.type === "Q") {
      const p1 = toPixel({ x: cmd.x1, y: cmd.y1 });
      const p2 = toPixel(cmd);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    } else if (cmd.type === "Z") {
      ctx.closePath();
    }
  }
  ctx.fill("nonzero");

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH).data;
  const out: PathCommand[] = [];

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      let maxAlpha = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = rx * scale + sx;
          const py = ry * scale + sy;
          const a = imgData[(py * canvasW + px) * 4 + 3];
          if (a > maxAlpha) maxAlpha = a;
        }
      }

      // If coverage is at least ~25%, place a dot
      if (maxAlpha < 64) continue;

      const fx = startX + (rx + 0.5) * s;
      const fy = endY - (ry + 0.5) * s;
      out.push(...circlePath(fx, fy, r));
    }
  }

  return out;
}

/**
 * Places equidistant circular dots along an open or closed stroke path (lines, quadratics, cubics).
 * Specifically designed for school tracing fonts (e.g. Open Khmer School Dotted) and handwriting copybooks.
 */
export function strokePathToDots(
  path: PathCommand[],
  spacing?: number,
  dotRadius?: number,
  unitsPerEm = 1000
): PathCommand[] {
  if (path.length === 0) return [];
  const s = spacing && spacing > 0 && !isNaN(spacing) ? spacing : Math.round(unitsPerEm * 0.045);
  const r =
    dotRadius && dotRadius > 0 && !isNaN(dotRadius)
      ? dotRadius
      : Math.max(1, Math.round(s * 0.38));

  const dots: { x: number; y: number }[] = [];
  let currentPos = { x: 0, y: 0 };
  let subpathStart = { x: 0, y: 0 };
  let polyline: { x: number; y: number }[] = [];

  function processSubpath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) {
      if (pts.length === 1) dots.push(pts[0]);
      return;
    }

    // Calculate cumulative arc length along polyline
    const dists = [0];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      totalLen += d;
      dists.push(totalLen);
    }
    if (totalLen <= 0) return;

    // Place dots at distance 0, s, 2s, ...
    let targetD = 0;
    let segIdx = 0;
    while (targetD <= totalLen) {
      while (segIdx < dists.length - 1 && dists[segIdx + 1] < targetD) {
        segIdx++;
      }
      const segLen = dists[segIdx + 1] - dists[segIdx];
      const t = segLen > 0 ? (targetD - dists[segIdx]) / segLen : 0;
      const x = pts[segIdx].x + t * (pts[segIdx + 1].x - pts[segIdx].x);
      const y = pts[segIdx].y + t * (pts[segIdx + 1].y - pts[segIdx].y);
      dots.push({ x, y });
      targetD += s;
    }

    // If endpoint is sufficiently separated from the last dot, place a dot at endpoint
    const lastD = dists[dists.length - 1];
    const prevDotD = targetD - s;
    if (lastD - prevDotD > s * 0.55) {
      dots.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    }
  }

  for (const cmd of path) {
    if (cmd.type === "M") {
      if (polyline.length > 1) processSubpath(polyline);
      currentPos = { x: cmd.x, y: cmd.y };
      subpathStart = { ...currentPos };
      polyline = [currentPos];
    } else if (cmd.type === "L") {
      currentPos = { x: cmd.x, y: cmd.y };
      polyline.push(currentPos);
    } else if (cmd.type === "C") {
      const p0 = currentPos;
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x2, y: cmd.y2 };
      const p3 = { x: cmd.x, y: cmd.y };
      const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const steps = Math.max(8, Math.min(60, Math.ceil(chord / 6)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
        const y = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;
        polyline.push({ x, y });
      }
      currentPos = p3;
    } else if (cmd.type === "Q") {
      const p0 = currentPos;
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x, y: cmd.y };
      const chord = Math.hypot(p2.x - p0.x, p2.y - p0.y);
      const steps = Math.max(6, Math.min(40, Math.ceil(chord / 6)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
        const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
        polyline.push({ x, y });
      }
      currentPos = p2;
    } else if (cmd.type === "Z") {
      if (polyline.length > 0) {
        polyline.push(subpathStart);
        processSubpath(polyline);
        polyline = [];
      }
    }
  }
  if (polyline.length > 1) processSubpath(polyline);

  const out: PathCommand[] = [];
  for (const d of dots) {
    out.push(...circlePath(d.x, d.y, r));
  }
  return out;
}

/**
 * Converts any glyph into a dot single-path (school tracing style).
 * If the glyph is already an open centerline stroke, it places dots along it.
 * If the glyph is a filled outline, it first extracts the centerline skeleton,
 * then samples equidistant dots along that centerline stroke.
 */
export function glyphToDotSinglePath(
  path: PathCommand[],
  spacing?: number,
  dotRadius?: number,
  unitsPerEm = 1000
): PathCommand[] {
  if (path.length === 0) return [];
  const hasClose = path.some((c) => c.type === "Z");
  if (!hasClose) {
    return strokePathToDots(path, spacing, dotRadius, unitsPerEm);
  }
  // Skeletonize filled outline into centerline strokes
  const skeleton = skeletonizeGlyph(path);
  return strokePathToDots(skeleton.length > 0 ? skeleton : path, spacing, dotRadius, unitsPerEm);
}
