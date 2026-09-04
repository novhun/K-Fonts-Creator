import ClipperLib from "clipper-lib";
import { PathCommand } from "./types";
import { splitContours } from "./glyphPath";

// Fixed-point scale for Clipper's integer coordinate space, and the
// resolution used to flatten curves to line segments before offsetting
// (Clipper only operates on polylines/polygons, not beziers).
const SCALE = 64;
const CURVE_SEGMENTS = 14;

interface Pt {
  x: number;
  y: number;
}

function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function quadPoint(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const mt = 1 - t;
  return { x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x, y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y };
}

/** Flattens one contour (starting with M, optionally ending with Z) into a polyline. */
function flattenContour(contour: PathCommand[]): { points: Pt[]; closed: boolean } {
  const points: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let closed = false;
  for (const cmd of contour) {
    if (cmd.type === "M" || cmd.type === "L") {
      cur = { x: cmd.x, y: cmd.y };
      points.push(cur);
    } else if (cmd.type === "C") {
      const p0 = cur;
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x2, y: cmd.y2 };
      const p3 = { x: cmd.x, y: cmd.y };
      for (let i = 1; i <= CURVE_SEGMENTS; i++) points.push(cubicPoint(p0, p1, p2, p3, i / CURVE_SEGMENTS));
      cur = p3;
    } else if (cmd.type === "Q") {
      const p0 = cur;
      const p1 = { x: cmd.x1, y: cmd.y1 };
      const p2 = { x: cmd.x, y: cmd.y };
      for (let i = 1; i <= CURVE_SEGMENTS; i++) points.push(quadPoint(p0, p1, p2, i / CURVE_SEGMENTS));
      cur = p2;
    } else if (cmd.type === "Z") {
      closed = true;
    }
  }
  return { points, closed };
}

/**
 * Expands single-line stroke centerlines into a filled outline (round joins
 * and caps) so the result can go through the same OTF/WOFF/WOFF2 export path
 * as ordinary filled glyphs — text rendering is always fill-based, so a
 * "single line" font still has to ship as a thin filled shape under the hood.
 * This only runs at export/preview time; the glyph's own stored path always
 * stays the simple, editable centerline stroke.
 */
export function strokeToOutline(path: PathCommand[], strokeWidth: number): PathCommand[] {
  if (strokeWidth <= 0) return [];
  const contours = splitContours(path);
  if (contours.length === 0) return [];

  const offset = new ClipperLib.ClipperOffset();
  let added = 0;
  for (const contour of contours) {
    const { points, closed } = flattenContour(contour);
    if (points.length < 2) continue;
    const clipperPath = points.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
    const endType = closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenRound;
    offset.AddPath(clipperPath, ClipperLib.JoinType.jtRound, endType);
    added++;
  }
  if (added === 0) return [];

  const solution = new ClipperLib.Paths();
  offset.Execute(solution, (strokeWidth / 2) * SCALE);

  const out: PathCommand[] = [];
  for (const poly of solution as { X: number; Y: number }[][]) {
    if (poly.length < 3) continue;
    out.push({ type: "M", x: poly[0].X / SCALE, y: poly[0].Y / SCALE });
    for (let i = 1; i < poly.length; i++) out.push({ type: "L", x: poly[i].X / SCALE, y: poly[i].Y / SCALE });
    out.push({ type: "Z" });
  }
  return out;
}
