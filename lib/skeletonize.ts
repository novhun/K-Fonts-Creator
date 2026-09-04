import { PathCommand } from "./types";
import { boundingBox } from "./glyphPath";

interface Pt {
  x: number;
  y: number;
}

// Each glyph is rasterized independently at this target resolution (long
// side, in pixels) before thinning — higher gives a more faithful skeleton
// but is slower and can produce more small jagged branches to clean up.
const TARGET_MAX_DIM = 160;
const PAD_PX = 10;
const SIMPLIFY_EPSILON_PX = 1.6;
const MIN_SEGMENT_LENGTH_PX = 6;

function buildTransform(bbox: { minX: number; minY: number; maxX: number; maxY: number }, scale: number, padPx: number) {
  return {
    toPixel: (p: Pt): Pt => ({ x: (p.x - bbox.minX) * scale + padPx, y: (bbox.maxY - p.y) * scale + padPx }),
    toFont: (p: Pt): Pt => ({ x: (p.x - padPx) / scale + bbox.minX, y: bbox.maxY - (p.y - padPx) / scale }),
  };
}

function rasterize(path: PathCommand[]) {
  const bbox = boundingBox(path);
  const bboxW = bbox.maxX - bbox.minX;
  const bboxH = bbox.maxY - bbox.minY;
  if (bboxW <= 0 || bboxH <= 0) return null;

  const scale = (TARGET_MAX_DIM - 2 * PAD_PX) / Math.max(bboxW, bboxH);
  const width = Math.round(bboxW * scale) + 2 * PAD_PX;
  const height = Math.round(bboxH * scale) + 2 * PAD_PX;
  const { toPixel, toFont } = buildTransform(bbox, scale, PAD_PX);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.beginPath();
  for (const cmd of path) {
    if (cmd.type === "M") {
      const p = toPixel({ x: cmd.x, y: cmd.y });
      ctx.moveTo(p.x, p.y);
    } else if (cmd.type === "L") {
      const p = toPixel({ x: cmd.x, y: cmd.y });
      ctx.lineTo(p.x, p.y);
    } else if (cmd.type === "C") {
      const p1 = toPixel({ x: cmd.x1, y: cmd.y1 });
      const p2 = toPixel({ x: cmd.x2, y: cmd.y2 });
      const p3 = toPixel({ x: cmd.x, y: cmd.y });
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    } else if (cmd.type === "Q") {
      const p1 = toPixel({ x: cmd.x1, y: cmd.y1 });
      const p2 = toPixel({ x: cmd.x, y: cmd.y });
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
    } else if (cmd.type === "Z") {
      ctx.closePath();
    }
  }
  ctx.fill("nonzero");

  const { data } = ctx.getImageData(0, 0, width, height);
  const bitmap = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) bitmap[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  return { bitmap, width, height, toFont };
}

/** Standard Zhang-Suen thinning: reduces a filled binary bitmap to a 1px-wide skeleton. */
function zhangSuenThin(source: Uint8Array, w: number, h: number): Uint8Array {
  const img = new Uint8Array(source);
  const get = (x: number, y: number) => (x < 0 || x >= w || y < 0 || y >= h ? 0 : img[y * w + x]);

  let changed = true;
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      const toRemove: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (get(x, y) !== 1) continue;
          const p2 = get(x, y - 1),
            p3 = get(x + 1, y - 1),
            p4 = get(x + 1, y),
            p5 = get(x + 1, y + 1),
            p6 = get(x, y + 1),
            p7 = get(x - 1, y + 1),
            p8 = get(x - 1, y),
            p9 = get(x - 1, y - 1);
          const n = [p2, p3, p4, p5, p6, p7, p8, p9];
          const B = n.reduce((a, b) => a + b, 0);
          if (B < 2 || B > 6) continue;
          let A = 0;
          for (let i = 0; i < 8; i++) if (n[i] === 0 && n[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;
          if (pass === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          toRemove.push(y * w + x);
        }
      }
      if (toRemove.length) {
        changed = true;
        for (const i of toRemove) img[i] = 0;
      }
    }
  }
  return img;
}

function countNeighbors(bitmap: Uint8Array, w: number, h: number, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && bitmap[ny * w + nx] === 1) out.push([nx, ny]);
    }
  }
  return out;
}

/**
 * Traces a thinned skeleton bitmap into pixel-space polylines via DFS over
 * pixel adjacency. Precisely reconstructing minimal branch topology at
 * junctions is fragile (Zhang-Suen junctions are often a small clump of
 * pixels, not one clean point); a DFS sidesteps that entirely by simply
 * guaranteeing every skeleton pixel gets visited, backtracking (retracing
 * the same edge) at branch points instead of trying to split into separate
 * "arms". A backtrack is visually and geometrically a no-op once the stroke
 * is expanded into a filled outline, since it retraces exactly the same line.
 */
function traceSkeleton(bitmap: Uint8Array, w: number, h: number): Pt[][] {
  const key = (x: number, y: number) => y * w + x;
  const fgPixels: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bitmap[y * w + x] === 1) fgPixels.push([x, y]);

  const visited = new Set<number>();
  const polylines: Pt[][] = [];

  for (const [sx, sy] of fgPixels) {
    if (visited.has(key(sx, sy))) continue;

    const line: [number, number][] = [];
    // Iterative DFS: each stack frame is [pixel, remaining unvisited neighbors to explore].
    const stack: { pt: [number, number]; nbrs: [number, number][] }[] = [];
    visited.add(key(sx, sy));
    line.push([sx, sy]);
    stack.push({ pt: [sx, sy], nbrs: countNeighbors(bitmap, w, h, sx, sy) });

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const next = frame.nbrs.find((n) => !visited.has(key(n[0], n[1])));
      if (!next) {
        stack.pop();
        if (stack.length) line.push(stack[stack.length - 1].pt); // backtrack
        continue;
      }
      visited.add(key(next[0], next[1]));
      line.push(next);
      stack.push({ pt: next, nbrs: countNeighbors(bitmap, w, h, next[0], next[1]) });
    }

    // If the walk ends adjacent to where it started (a closed loop), add the
    // start point once more so the downstream closed-path detection kicks in.
    const first = line[0];
    const last = line[line.length - 1];
    if (line.length > 2 && !(first[0] === last[0] && first[1] === last[1])) {
      const dx = Math.abs(first[0] - last[0]);
      const dy = Math.abs(first[1] - last[1]);
      if (dx <= 1 && dy <= 1) line.push(first);
    }

    if (line.length >= 2) polylines.push(line.map(([px, py]) => ({ x: px, y: py })));
  }

  return polylines;
}

function pointLineDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function douglasPeucker(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function polylineLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return len;
}

/**
 * Approximates a centerline skeleton for a filled glyph outline: rasterize,
 * thin (Zhang-Suen), trace the skeleton into polylines, then simplify and
 * map back to font units. This is a best-effort approximation, not exact
 * medial-axis math — expect some jagged or spurious short branches on
 * complex shapes, which may need manual cleanup with the eraser/select tools
 * afterward.
 */
export function skeletonizeGlyph(path: PathCommand[]): PathCommand[] {
  const raster = rasterize(path);
  if (!raster) return [];
  const { bitmap, width, height, toFont } = raster;

  const thinned = zhangSuenThin(bitmap, width, height);
  const rawPolylines = traceSkeleton(thinned, width, height);

  const out: PathCommand[] = [];
  for (const raw of rawPolylines) {
    if (polylineLength(raw) < MIN_SEGMENT_LENGTH_PX) continue;
    const simplified = douglasPeucker(raw, SIMPLIFY_EPSILON_PX);
    if (simplified.length < 2) continue;

    const fontPts = simplified.map(toFont);
    const first = fontPts[0];
    const last = fontPts[fontPts.length - 1];
    const isClosed = fontPts.length > 2 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-3;
    const body = isClosed ? fontPts.slice(0, -1) : fontPts;

    out.push({ type: "M", x: body[0].x, y: body[0].y });
    for (let i = 1; i < body.length; i++) out.push({ type: "L", x: body[i].x, y: body[i].y });
    if (isClosed) out.push({ type: "Z" });
  }
  return out;
}
