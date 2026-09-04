import { GlyphRecord, PathCommand } from "./types";

/** Split a flat opentype-style command list into per-contour arrays (each starting with M). */
export function splitContours(path: PathCommand[]): PathCommand[][] {
  const contours: PathCommand[][] = [];
  let current: PathCommand[] = [];
  for (const cmd of path) {
    if (cmd.type === "M") {
      if (current.length) contours.push(current);
      current = [cmd];
    } else {
      current.push(cmd);
    }
  }
  if (current.length) contours.push(current);
  return contours;
}

export function joinContours(contours: PathCommand[][]): PathCommand[] {
  return contours.flat();
}

/** Convert a single contour (array of commands) to an SVG path `d` string. */
export function contourToSvgD(contour: PathCommand[]): string {
  let d = "";
  for (const cmd of contour) {
    switch (cmd.type) {
      case "M":
        d += `M ${cmd.x} ${cmd.y} `;
        break;
      case "L":
        d += `L ${cmd.x} ${cmd.y} `;
        break;
      case "C":
        d += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
        break;
      case "Q":
        d += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
        break;
      case "Z":
        d += "Z ";
        break;
    }
  }
  return d.trim();
}

export function pathToSvgD(path: PathCommand[]): string {
  return splitContours(path).map(contourToSvgD).join(" ");
}

/** Last on-curve anchor point (x,y) of a command, or undefined for Z. */
export function commandEndPoint(cmd: PathCommand): { x: number; y: number } | undefined {
  if (cmd.type === "Z") return undefined;
  return { x: cmd.x, y: cmd.y };
}

export function boundingBox(path: PathCommand[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const cmd of path) {
    if (cmd.type === "Z") continue;
    consider(cmd.x, cmd.y);
    if (cmd.type === "C") {
      consider(cmd.x1, cmd.y1);
      consider(cmd.x2, cmd.y2);
    }
    if (cmd.type === "Q") {
      consider(cmd.x1, cmd.y1);
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

export function translatePath(path: PathCommand[], dx: number, dy: number): PathCommand[] {
  return path.map((cmd) => {
    if (cmd.type === "Z") return cmd;
    if (cmd.type === "C") {
      return { ...cmd, x: cmd.x + dx, y: cmd.y + dy, x1: cmd.x1 + dx, y1: cmd.y1 + dy, x2: cmd.x2 + dx, y2: cmd.y2 + dy };
    }
    if (cmd.type === "Q") {
      return { ...cmd, x: cmd.x + dx, y: cmd.y + dy, x1: cmd.x1 + dx, y1: cmd.y1 + dy };
    }
    return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
  });
}

export function clonePath(path: PathCommand[]): PathCommand[] {
  return path.map((c) => ({ ...c }));
}

export function isGlyphDrawn(glyph: GlyphRecord | undefined): boolean {
  return !!glyph && glyph.path.length > 0;
}

export function snap(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function makeGlyphId(projectId: string, unicodeHex: string): string {
  return `${projectId}::${unicodeHex}`;
}

export function defaultGlyphRecord(projectId: string, unicodeHex: string, advanceWidth: number): GlyphRecord {
  const isSubscript = unicodeHex.startsWith("17D2_") || unicodeHex.startsWith("17D2");
  return {
    id: makeGlyphId(projectId, unicodeHex),
    projectId,
    unicode: unicodeHex,
    name: `uni${unicodeHex.toUpperCase()}`,
    advanceWidth: isSubscript ? 0 : advanceWidth,
    leftSideBearing: isSubscript ? 0 : Math.round(advanceWidth * 0.1),
    path: [],
    updatedAt: Date.now(),
  };
}

// --- Point-level editing helpers (used by the interactive canvas) ----------

export type PointPart = "anchor" | "c1" | "c2";
export interface PointRef {
  idx: number; // index into the flat path array
  part: PointPart;
}

export function getPointCoord(path: PathCommand[], ref: PointRef): { x: number; y: number } | undefined {
  const cmd = path[ref.idx];
  if (!cmd || cmd.type === "Z") return undefined;
  if (ref.part === "anchor") return { x: cmd.x, y: cmd.y };
  if (ref.part === "c1" && (cmd.type === "C" || cmd.type === "Q")) return { x: cmd.x1, y: cmd.y1 };
  if (ref.part === "c2" && cmd.type === "C") return { x: cmd.x2, y: cmd.y2 };
  return undefined;
}

export function setPointCoord(path: PathCommand[], ref: PointRef, x: number, y: number): PathCommand[] {
  return path.map((cmd, i) => {
    if (i !== ref.idx || cmd.type === "Z") return cmd;
    if (ref.part === "anchor") return { ...cmd, x, y };
    if (ref.part === "c1" && (cmd.type === "C" || cmd.type === "Q")) return { ...cmd, x1: x, y1: y };
    if (ref.part === "c2" && cmd.type === "C") return { ...cmd, x2: x, y2: y };
    return cmd;
  });
}

/**
 * Finds the point nearest to (ux, uy) within `threshold` font units. Handles
 * (c1/c2) are only considered for `preferHandlesOnIdx` (typically the
 * selected command), so the canvas doesn't clutter every curve with
 * draggable handles at once.
 */
export function hitTestPoint(
  path: PathCommand[],
  ux: number,
  uy: number,
  threshold: number,
  preferHandlesOnIdx?: number
): PointRef | null {
  let best: { ref: PointRef; distSq: number } | null = null;
  const consider = (ref: PointRef, x: number, y: number) => {
    const dx = x - ux;
    const dy = y - uy;
    const d = dx * dx + dy * dy;
    if (d <= threshold * threshold && (!best || d < best.distSq)) best = { ref, distSq: d };
  };

  if (preferHandlesOnIdx !== undefined) {
    const cmd = path[preferHandlesOnIdx];
    if (cmd && cmd.type === "C") {
      consider({ idx: preferHandlesOnIdx, part: "c1" }, cmd.x1, cmd.y1);
      consider({ idx: preferHandlesOnIdx, part: "c2" }, cmd.x2, cmd.y2);
    } else if (cmd && cmd.type === "Q") {
      consider({ idx: preferHandlesOnIdx, part: "c1" }, cmd.x1, cmd.y1);
    }
  }
  if (best) return best;

  path.forEach((cmd, idx) => {
    if (cmd.type === "Z") return;
    consider({ idx, part: "anchor" }, cmd.x, cmd.y);
  });
  return best;
}

function findContourBounds(path: PathCommand[], idx: number): { start: number; end: number } {
  let start = idx;
  while (start > 0 && path[start].type !== "M") start--;
  let end = start + 1;
  while (end < path.length && path[end].type !== "M") end++;
  return { start, end };
}

/** Removes a single anchor point (and its command) from its contour, collapsing degenerate contours. */
export function deletePointAt(path: PathCommand[], idx: number): PathCommand[] {
  const { start, end } = findContourBounds(path, idx);
  const contour = path.slice(start, end);
  const localIdx = idx - start;
  contour.splice(localIdx, 1);

  if (localIdx === 0 && contour.length > 0 && contour[0].type !== "Z") {
    const promoted = contour[0];
    contour[0] = { type: "M", x: promoted.x, y: promoted.y };
  }

  const meaningful = contour.filter((c) => c.type === "L" || c.type === "C" || c.type === "Q").length;
  const newContour = meaningful === 0 ? [] : contour;

  return [...path.slice(0, start), ...newContour, ...path.slice(end)];
}

export function deleteContourContaining(path: PathCommand[], idx: number): PathCommand[] {
  const { start, end } = findContourBounds(path, idx);
  return [...path.slice(0, start), ...path.slice(end)];
}

export function isLastContourOpen(path: PathCommand[]): boolean {
  return path.length > 0 && path[path.length - 1].type !== "Z";
}

export function lastContourStartPoint(path: PathCommand[]): { x: number; y: number } | null {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].type === "M") return commandEndPoint(path[i]) ?? null;
    if (path[i].type === "Z") return null;
  }
  return null;
}

export function lastPoint(path: PathCommand[]): { x: number; y: number } | null {
  if (path.length === 0) return null;
  const last = path[path.length - 1];
  if (last.type === "Z") return lastContourStartPoint(path.slice(0, -1));
  return commandEndPoint(last) ?? null;
}

export function appendMove(path: PathCommand[], x: number, y: number): PathCommand[] {
  return [...path, { type: "M", x, y }];
}
export function appendLine(path: PathCommand[], x: number, y: number): PathCommand[] {
  return [...path, { type: "L", x, y }];
}
export function appendCurve(
  path: PathCommand[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number
): PathCommand[] {
  return [...path, { type: "C", x1, y1, x2, y2, x, y }];
}
export function closeContour(path: PathCommand[]): PathCommand[] {
  return [...path, { type: "Z" }];
}

/** The on-curve point immediately preceding `idx` — the start of that segment. */
export function previousAnchorPoint(path: PathCommand[], idx: number): { x: number; y: number } | null {
  if (idx <= 0) return null;
  const p = path[idx - 1];
  if (p.type === "Z") return null;
  return commandEndPoint(p) ?? null;
}

// --- Shape Generators --------------------------------------------------------

/** Creates a closed rectangle path. */
export function createRectangle(
  x: number,
  y: number,
  w: number,
  h: number,
  cornerRadius: number = 0
): PathCommand[] {
  const x1 = Math.min(x, x + w);
  const x2 = Math.max(x, x + w);
  const y1 = Math.min(y, y + h);
  const y2 = Math.max(y, y + h);
  const width = x2 - x1;
  const height = y2 - y1;

  if (cornerRadius <= 0 || width <= cornerRadius * 2 || height <= cornerRadius * 2) {
    return [
      { type: "M", x: x1, y: y1 },
      { type: "L", x: x2, y: y1 },
      { type: "L", x: x2, y: y2 },
      { type: "L", x: x1, y: y2 },
      { type: "Z" },
    ];
  }

  const r = Math.min(cornerRadius, width / 2, height / 2);
  const k = 0.5522847498 * r;

  return [
    { type: "M", x: x1 + r, y: y1 },
    { type: "L", x: x2 - r, y: y1 },
    { type: "C", x1: x2 - r + k, y1: y1, x2: x2, y2: y1 + r - k, x: x2, y: y1 + r },
    { type: "L", x: x2, y: y2 - r },
    { type: "C", x1: x2, y1: y2 - r + k, x2: x2 - r + k, y2: y2, x: x2 - r, y: y2 },
    { type: "L", x: x1 + r, y: y2 },
    { type: "C", x1: x1 + r - k, y1: y2, x2: x1, y2: y2 - r + k, x: x1, y: y2 - r },
    { type: "L", x: x1, y: y1 + r },
    { type: "C", x1: x1, y1: y1 + r - k, x2: x1 + r - k, y2: y1, x: x1 + r, y: y1 },
    { type: "Z" },
  ];
}

/** Creates a 4-bezier cubic ellipse/circle path. */
export function createEllipse(cx: number, cy: number, rx: number, ry: number): PathCommand[] {
  const absRx = Math.abs(rx);
  const absRy = Math.abs(ry);
  const kx = 0.5522847498 * absRx;
  const ky = 0.5522847498 * absRy;

  return [
    { type: "M", x: cx, y: cy + absRy },
    { type: "C", x1: cx + kx, y1: cy + absRy, x2: cx + absRx, y2: cy + ky, x: cx + absRx, y: cy },
    { type: "C", x1: cx + absRx, y1: cy - ky, x2: cx + kx, y2: cy - absRy, x: cx, y: cy - absRy },
    { type: "C", x1: cx - kx, y1: cy - absRy, x2: cx - absRx, y2: cy - ky, x: cx - absRx, y: cy },
    { type: "C", x1: cx - absRx, y1: cy + ky, x2: cx - kx, y2: cy + absRy, x: cx, y: cy + absRy },
    { type: "Z" },
  ];
}

/** Creates a triangle shape. */
export function createTriangle(x: number, y: number, w: number, h: number): PathCommand[] {
  const cx = x + w / 2;
  return [
    { type: "M", x: cx, y: y + h },
    { type: "L", x: x + w, y: y },
    { type: "L", x: x, y: y },
    { type: "Z" },
  ];
}

/** Creates a regular n-sided polygon. */
export function createPolygon(cx: number, cy: number, r: number, sides: number = 5): PathCommand[] {
  const commands: PathCommand[] = [];
  const count = Math.max(3, sides);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) - (i * 2 * Math.PI) / count;
    const px = Math.round(cx + r * Math.cos(angle));
    const py = Math.round(cy + r * Math.sin(angle));
    if (i === 0) {
      commands.push({ type: "M", x: px, y: py });
    } else {
      commands.push({ type: "L", x: px, y: py });
    }
  }
  commands.push({ type: "Z" });
  return commands;
}

/** Creates a straight line segment. */
export function createLine(x1: number, y1: number, x2: number, y2: number): PathCommand[] {
  return [
    { type: "M", x: x1, y: y1 },
    { type: "L", x: x2, y: y2 },
  ];
}

// --- Multi-Point & Contour Selection / Deletion -----------------------------

/** Finds all anchor point indices within the given rectangular bounds. */
export function findPointsInRect(
  path: PathCommand[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number[] {
  const result: number[] = [];
  path.forEach((cmd, idx) => {
    if (cmd.type === "Z") return;
    if (cmd.x >= minX && cmd.x <= maxX && cmd.y >= minY && cmd.y <= maxY) {
      result.push(idx);
    }
  });
  return result;
}

/** Finds which contour index a given command index belongs to. */
export function findContourIndexForPoint(path: PathCommand[], pointIdx: number): number {
  let count = -1;
  for (let i = 0; i <= pointIdx && i < path.length; i++) {
    if (path[i].type === "M") count++;
  }
  return Math.max(0, count);
}

/** Gets all flat command indices that belong to a specific contour index. */
export function getContourPointIndices(path: PathCommand[], contourIdx: number): number[] {
  const indices: number[] = [];
  let currentContour = -1;
  for (let i = 0; i < path.length; i++) {
    if (path[i].type === "M") currentContour++;
    if (currentContour === contourIdx) {
      indices.push(i);
    }
  }
  return indices;
}

/** Deletes a specific contour by contour index. */
export function deleteContourAt(path: PathCommand[], contourIdx: number): PathCommand[] {
  const contours = splitContours(path);
  if (contourIdx < 0 || contourIdx >= contours.length) return path;
  contours.splice(contourIdx, 1);
  return joinContours(contours);
}

/** Deletes multiple anchor points by their flat indices, cleanly reconnecting contours. */
export function deletePoints(path: PathCommand[], indices: number[]): PathCommand[] {
  if (!indices.length) return path;
  const indexSet = new Set(indices);
  const contours = splitContours(path);
  const newContours: PathCommand[][] = [];

  let globalIdx = 0;
  for (const contour of contours) {
    const keep: { cmd: PathCommand; origIdx: number }[] = [];
    for (const cmd of contour) {
      const curIdx = globalIdx++;
      if (!indexSet.has(curIdx)) {
        keep.push({ cmd: { ...cmd }, origIdx: curIdx });
      }
    }

    if (keep.length === 0) continue;

    // Filter out trailing Z if no anchors remain
    const nonZ = keep.filter((k): k is { cmd: Exclude<PathCommand, { type: "Z" }>; origIdx: number } => k.cmd.type !== "Z");
    if (nonZ.length === 0) continue;

    // Promote first point to M if needed
    if (nonZ[0].cmd.type !== "M") {
      const first = nonZ[0].cmd;
      nonZ[0].cmd = { type: "M", x: first.x, y: first.y };
    }

    // Has at least one line or curve command
    const hasSegments = nonZ.some((k) => k.cmd.type === "L" || k.cmd.type === "C" || k.cmd.type === "Q");
    const hadZ = keep.some((k) => k.cmd.type === "Z");

    if (!hasSegments && nonZ.length <= 1) {
      // Degenerate single point contour, discard
      continue;
    }

    const reconstructed: PathCommand[] = nonZ.map((k) => k.cmd);
    if (hadZ && nonZ.length >= 3) {
      reconstructed.push({ type: "Z" });
    }

    newContours.push(reconstructed);
  }

  return joinContours(newContours);
}

/** Moves multiple anchor points (and their attached curve handles) by (dx, dy). */
export function movePoints(
  path: PathCommand[],
  indices: number[],
  dx: number,
  dy: number
): PathCommand[] {
  if (dx === 0 && dy === 0) return path;
  const indexSet = new Set(indices);
  const result = clonePath(path);

  for (let i = 0; i < result.length; i++) {
    const cmd = result[i];
    if (cmd.type === "Z") continue;

    if (indexSet.has(i)) {
      cmd.x += dx;
      cmd.y += dy;
      // Incoming handle for this anchor
      if (cmd.type === "C") {
        cmd.x2 += dx;
        cmd.y2 += dy;
      }
      // Outgoing handle from this anchor to next segment
      if (i + 1 < result.length && result[i + 1].type === "C" && !indexSet.has(i + 1)) {
        const nextCmd = result[i + 1] as Extract<PathCommand, { type: "C" }>;
        nextCmd.x1 += dx;
        nextCmd.y1 += dy;
      }
    }
  }

  return result;
}

// --- Segment Hit-Testing & Splitting -----------------------------------------

export interface SegmentHit {
  segmentIdx: number; // Command index of this segment (L, C, or Q)
  t: number;
  x: number;
  y: number;
  dist: number;
}

function distToLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { dist: number; t: number; x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(px - x1, py - y1), t: 0, x: x1, y: y1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return { dist: Math.hypot(px - qx, py - qy), t, x: qx, y: qy };
}

function cubicEval(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function distToCubic(
  px: number,
  py: number,
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number
): { dist: number; t: number; x: number; y: number } {
  let bestDist = Infinity;
  let bestT = 0;
  let bestX = p0x;
  let bestY = p0y;

  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = cubicEval(p0x, p1x, p2x, p3x, t);
    const y = cubicEval(p0y, p1y, p2y, p3y, t);
    const d = Math.hypot(px - x, py - y);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
      bestX = x;
      bestY = y;
    }
  }

  // Refine locally around bestT
  const delta = 1 / (steps * 2);
  const t1 = Math.max(0, bestT - delta);
  const t2 = Math.min(1, bestT + delta);
  for (let i = 0; i <= 8; i++) {
    const t = t1 + (i / 8) * (t2 - t1);
    const x = cubicEval(p0x, p1x, p2x, p3x, t);
    const y = cubicEval(p0y, p1y, p2y, p3y, t);
    const d = Math.hypot(px - x, py - y);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
      bestX = x;
      bestY = y;
    }
  }

  return { dist: bestDist, t: bestT, x: bestX, y: bestY };
}

/** Hit-tests all line and curve segments in the path within a threshold distance. */
export function hitTestSegment(
  path: PathCommand[],
  ux: number,
  uy: number,
  threshold: number
): SegmentHit | null {
  let best: SegmentHit | null = null;

  for (let i = 0; i < path.length; i++) {
    const cmd = path[i];
    if (cmd.type === "M" || cmd.type === "Z") continue;

    const prev = previousAnchorPoint(path, i);
    if (!prev) continue;

    if (cmd.type === "L") {
      const res = distToLine(ux, uy, prev.x, prev.y, cmd.x, cmd.y);
      if (res.dist <= threshold && (!best || res.dist < best.dist)) {
        best = { segmentIdx: i, t: res.t, x: res.x, y: res.y, dist: res.dist };
      }
    } else if (cmd.type === "C") {
      const res = distToCubic(ux, uy, prev.x, prev.y, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
      if (res.dist <= threshold && (!best || res.dist < best.dist)) {
        best = { segmentIdx: i, t: res.t, x: res.x, y: res.y, dist: res.dist };
      }
    }
  }

  return best;
}

/** Splits a segment at parameter t, inserting a new anchor point without changing curve geometry. */
export function splitSegmentAt(path: PathCommand[], segmentIdx: number, t: number): PathCommand[] {
  if (segmentIdx < 0 || segmentIdx >= path.length || t <= 0.01 || t >= 0.99) return path;
  const cmd = path[segmentIdx];
  const prev = previousAnchorPoint(path, segmentIdx);
  if (!prev) return path;

  if (cmd.type === "L") {
    const splitX = Math.round(prev.x + t * (cmd.x - prev.x));
    const splitY = Math.round(prev.y + t * (cmd.y - prev.y));
    const newCmds: PathCommand[] = [
      { type: "L", x: splitX, y: splitY },
      { type: "L", x: cmd.x, y: cmd.y },
    ];
    return [...path.slice(0, segmentIdx), ...newCmds, ...path.slice(segmentIdx + 1)];
  }

  if (cmd.type === "C") {
    // de Casteljau split
    const p0 = prev;
    const p1 = { x: cmd.x1, y: cmd.y1 };
    const p2 = { x: cmd.x2, y: cmd.y2 };
    const p3 = { x: cmd.x, y: cmd.y };

    const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, f: number) => ({
      x: a.x + f * (b.x - a.x),
      y: a.y + f * (b.y - a.y),
    });

    const p01 = lerp(p0, p1, t);
    const p12 = lerp(p1, p2, t);
    const p23 = lerp(p2, p3, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const p0123 = lerp(p012, p123, t);

    const c1: PathCommand = {
      type: "C",
      x1: Math.round(p01.x),
      y1: Math.round(p01.y),
      x2: Math.round(p012.x),
      y2: Math.round(p012.y),
      x: Math.round(p0123.x),
      y: Math.round(p0123.y),
    };
    const c2: PathCommand = {
      type: "C",
      x1: Math.round(p123.x),
      y1: Math.round(p123.y),
      x2: Math.round(p23.x),
      y2: Math.round(p23.y),
      x: cmd.x,
      y: cmd.y,
    };

    return [...path.slice(0, segmentIdx), c1, c2, ...path.slice(segmentIdx + 1)];
  }

  return path;
}

/** Toggles an anchor between sharp corner and smooth curve. */
export function togglePointSmooth(path: PathCommand[], idx: number): PathCommand[] {
  const cmd = path[idx];
  if (!cmd || cmd.type === "Z") return path;

  const result = clonePath(path);
  const cur = result[idx];
  if (!cur || cur.type === "Z") return path;
  const curX = cur.x;
  const curY = cur.y;
  const next = idx + 1 < result.length ? result[idx + 1] : null;

  // If already a curve with handles, collapse handles to create sharp corner
  if (cur.type === "C" || (next && next.type === "C")) {
    if (cur.type === "C") {
      cur.x2 = curX;
      cur.y2 = curY;
    }
    if (next && next.type === "C") {
      next.x1 = curX;
      next.y1 = curY;
    }
  } else {
    // If straight, convert to curve with default tangent handles
    const prev = previousAnchorPoint(path, idx);
    const p0 = prev ?? { x: curX - 50, y: curY };
    const pNext = next && next.type !== "Z" ? { x: next.x, y: next.y } : { x: curX + 50, y: curY };

    const dx = pNext.x - p0.x;
    const dy = pNext.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const handleLen = Math.min(60, len * 0.25);
    const ux = (dx / len) * handleLen;
    const uy = (dy / len) * handleLen;

    if (cur.type === "L") {
      result[idx] = {
        type: "C",
        x1: Math.round(p0.x + (curX - p0.x) / 3),
        y1: Math.round(p0.y + (curY - p0.y) / 3),
        x2: Math.round(curX - ux),
        y2: Math.round(curY - uy),
        x: curX,
        y: curY,
      };
    }
    if (next && next.type === "L") {
      result[idx + 1] = {
        type: "C",
        x1: Math.round(curX + ux),
        y1: Math.round(curY + uy),
        x2: Math.round(next.x - (next.x - curX) / 3),
        y2: Math.round(next.y - (next.y - curY) / 3),
        x: next.x,
        y: next.y,
      };
    }
  }

  return result;
}
