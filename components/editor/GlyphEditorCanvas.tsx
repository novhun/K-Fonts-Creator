"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/lib/projectStore";
import { PathCommand, ToolId } from "@/lib/types";
import * as GP from "@/lib/glyphPath";
import EditorToolbar from "./EditorToolbar";
import { findUnicodeChar } from "@/lib/unicodeRanges";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
const HIT_RADIUS_PX = 9;
const POINT_R_PX = 4.5;
const ERASER_RADIUS_PX = 14;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

type DragState =
  | { type: "pan"; startScreen: { x: number; y: number }; startPan: { x: number; y: number } }
  | { type: "points"; indices: number[]; origPath: PathCommand[]; startFont: { x: number; y: number }; moved: boolean }
  | { type: "handle"; cmdIdx: number; part: "c1" | "c2"; origPath: PathCommand[] }
  | { type: "pen-drag"; anchorIdx: number; startFont: { x: number; y: number }; origPath: PathCommand[] }
  | { type: "shape"; shapeType: ToolId; startFont: { x: number; y: number } }
  | { type: "marquee"; startFont: { x: number; y: number } }
  | { type: "eraser" }
  | null;

interface HistoryState {
  stack: PathCommand[][];
  index: number;
}

export default function GlyphEditorCanvas() {
  const project = useProjectStore((s) => s.project);
  const currentHex = useProjectStore((s) => s.currentHex);
  const glyphs = useProjectStore((s) => s.glyphs);
  const updateGlyphPath = useProjectStore((s) => s.updateGlyphPath);
  const glyph = currentHex ? glyphs[currentHex] : undefined;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [tool, setTool] = useState<ToolId>("select");
  const [view, setView] = useState({ zoom: 0.3, pan: { x: 0, y: 0 } });
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(50);

  // Selection states
  const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());
  const [selectedContour, setSelectedContour] = useState<number | null>(null);
  const [activeHandle, setActiveHandle] = useState<{ cmdIdx: number; part: "c1" | "c2" } | null>(null);

  // Live drawing states
  const [rubberBandPoint, setRubberBandPoint] = useState<{ x: number; y: number } | null>(null);
  const [isNearStartPoint, setIsNearStartPoint] = useState(false);
  const [shapePreview, setShapePreview] = useState<PathCommand[] | null>(null);
  const [shapeDimensions, setShapeDimensions] = useState<{ w: number; h: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const [hist, setHist] = useState<HistoryState>({ stack: [[]], index: 0 });
  const [liveOverride, setLiveOverride] = useState<PathCommand[] | null>(null);
  const path = liveOverride ?? hist.stack[hist.index] ?? [];

  const dragRef = useRef<DragState>(null);
  const [userAdjustedView, setUserAdjustedView] = useState(false);

  // Reset editing state whenever the selected glyph changes
  useEffect(() => {
    if (!currentHex) return;
    const g = useProjectStore.getState().glyphs[currentHex];
    const initial = g ? GP.clonePath(g.path) : [];
    setHist({ stack: [initial], index: 0 });
    setLiveOverride(null);
    setSelectedPoints(new Set());
    setSelectedContour(null);
    setActiveHandle(null);
    setShapePreview(null);
    setRubberBandPoint(null);
    setUserAdjustedView(false);
    dragRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHex, project?.fontMode]);

  // Track container size and wheel-zoom
  const containerCleanupRef = useRef<(() => void) | null>(null);
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    containerCleanupRef.current?.();
    containerCleanupRef.current = null;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setUserAdjustedView(true);
      setView((v) => {
        const ux = (sx - v.pan.x) / v.zoom;
        const uy = (v.pan.y - sy) / v.zoom;
        const factor = Math.exp(-e.deltaY * 0.001);
        const newZoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        return { zoom: newZoom, pan: { x: sx - ux * newZoom, y: sy + uy * newZoom } };
      });
    };
    el.addEventListener("wheel", wheelHandler, { passive: false });

    containerCleanupRef.current = () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheelHandler);
    };
  }, []);

  function fitToView() {
    if (!project) return;
    const w = size.w,
      h = size.h;
    if (w <= 0 || h <= 0) return;
    const advanceWidth = glyph?.advanceWidth ?? Math.round(project.unitsPerEm * 0.6);
    const spanX = advanceWidth || project.unitsPerEm;
    const spanY = project.ascender - project.descender || project.unitsPerEm;
    const pad = 0.25;
    const viewW = spanX * (1 + 2 * pad);
    const viewH = spanY * (1 + 2 * pad);
    const zoom = clamp(Math.min(w / viewW, h / viewH), MIN_ZOOM, MAX_ZOOM);
    const centerX = advanceWidth / 2;
    const centerY = (project.ascender + project.descender) / 2;
    setView({ zoom, pan: { x: w / 2 - centerX * zoom, y: h / 2 + centerY * zoom } });
  }

  useEffect(() => {
    if (!currentHex || userAdjustedView) return;
    if (size.w > 0 && size.h > 0) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHex, size.w, size.h, userAdjustedView]);

  function commit(newPath: PathCommand[]) {
    setLiveOverride(null);
    setHist((prev) => {
      const stack = [...prev.stack.slice(0, prev.index + 1), newPath];
      return { stack, index: stack.length - 1 };
    });
    if (currentHex) updateGlyphPath(currentHex, newPath);
  }

  function undo() {
    setHist((prev) => {
      if (prev.index <= 0) return prev;
      const idx = prev.index - 1;
      if (currentHex) updateGlyphPath(currentHex, prev.stack[idx]);
      return { ...prev, index: idx };
    });
    setSelectedPoints(new Set());
    setSelectedContour(null);
  }

  function redo() {
    setHist((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev;
      const idx = prev.index + 1;
      if (currentHex) updateGlyphPath(currentHex, prev.stack[idx]);
      return { ...prev, index: idx };
    });
    setSelectedPoints(new Set());
    setSelectedContour(null);
  }

  function zoomBy(factor: number) {
    setUserAdjustedView(true);
    const cx = size.w / 2,
      cy = size.h / 2;
    setView((v) => {
      const ux = (cx - v.pan.x) / v.zoom;
      const uy = (v.pan.y - cy) / v.zoom;
      const newZoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      return { zoom: newZoom, pan: { x: cx - ux * newZoom, y: cy + uy * newZoom } };
    });
  }

  function screenToFont(sx: number, sy: number) {
    return { x: (sx - view.pan.x) / view.zoom, y: (view.pan.y - sy) / view.zoom };
  }

  function fontToScreen(ux: number, uy: number) {
    return { sx: view.pan.x + ux * view.zoom, sy: view.pan.y - uy * view.zoom };
  }

  // --- Deletion Handlers -----------------------------------------------------

  function handleDeleteSelection() {
    if (selectedPoints.size > 0) {
      commit(GP.deletePoints(path, Array.from(selectedPoints)));
      setSelectedPoints(new Set());
      setSelectedContour(null);
    } else if (selectedContour !== null) {
      commit(GP.deleteContourAt(path, selectedContour));
      setSelectedContour(null);
    }
  }

  function handleDeleteContour() {
    if (selectedContour !== null) {
      commit(GP.deleteContourAt(path, selectedContour));
      setSelectedContour(null);
      setSelectedPoints(new Set());
    } else if (selectedPoints.size > 0) {
      const firstIdx = Array.from(selectedPoints)[0];
      const contourIdx = GP.findContourIndexForPoint(path, firstIdx);
      commit(GP.deleteContourAt(path, contourIdx));
      setSelectedContour(null);
      setSelectedPoints(new Set());
    }
  }

  function handleClearAll() {
    if (path.length === 0) return;
    commit([]);
    setSelectedPoints(new Set());
    setSelectedContour(null);
  }

  // --- Keyboard Shortcuts ----------------------------------------------------

  useEffect(() => {
    function isTypingTarget(t: EventTarget | null) {
      const tag = (t as HTMLElement)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA";
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.code === "Space") {
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "p":
          setTool("pen");
          break;
        case "l":
          setTool("pen-line");
          break;
        case "c":
          setTool("pen-curve");
          break;
        case "r":
          setTool("shape-rect");
          break;
        case "o":
          setTool("shape-circle");
          break;
        case "t":
          setTool("shape-triangle");
          break;
        case "e":
          setTool("eraser");
          break;
        case "h":
          setTool("pan");
          break;
        case "enter":
          if (GP.isLastContourOpen(path)) commit(GP.closeContour(path));
          break;
        case "escape":
          setSelectedPoints(new Set());
          setSelectedContour(null);
          setActiveHandle(null);
          setShapePreview(null);
          setRubberBandPoint(null);
          break;
        case "delete":
        case "backspace":
          handleDeleteSelection();
          break;
        case "=":
        case "+":
          zoomBy(1.2);
          break;
        case "-":
          zoomBy(1 / 1.2);
          break;
        case "0":
          setUserAdjustedView(false);
          fitToView();
          break;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, selectedPoints, selectedContour, view, hist, size]);

  // --- Pointer Interactions --------------------------------------------------

  function handlePointerDown(e: React.PointerEvent) {
    if (!containerRef.current || !glyph) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (tool === "pan" || spaceDown || e.button === 1) {
      dragRef.current = { type: "pan", startScreen: { x: e.clientX, y: e.clientY }, startPan: { ...view.pan } };
      return;
    }
    if (e.button !== 0) return;

    let { x: ux, y: uy } = screenToFont(sx, sy);
    if (snapToGrid && !tool.startsWith("shape-")) {
      ux = GP.snap(ux, gridSize);
      uy = GP.snap(uy, gridSize);
    }

    const thresholdUnits = HIT_RADIUS_PX / view.zoom;

    // 1. SELECT TOOL
    if (tool === "select") {
      // Check handles of selected point first
      if (selectedPoints.size === 1) {
        const selIdx = Array.from(selectedPoints)[0];
        const cmd = path[selIdx];
        const next = selIdx + 1 < path.length ? path[selIdx + 1] : null;

        // Incoming handle (c2 of current command)
        if (cmd.type === "C" && Math.hypot(cmd.x2 - ux, cmd.y2 - uy) <= thresholdUnits) {
          dragRef.current = { type: "handle", cmdIdx: selIdx, part: "c2", origPath: path };
          setActiveHandle({ cmdIdx: selIdx, part: "c2" });
          return;
        }
        // Outgoing handle (c1 of next command)
        if (next && next.type === "C" && Math.hypot(next.x1 - ux, next.y1 - uy) <= thresholdUnits) {
          dragRef.current = { type: "handle", cmdIdx: selIdx + 1, part: "c1", origPath: path };
          setActiveHandle({ cmdIdx: selIdx + 1, part: "c1" });
          return;
        }
      }

      // Check hit on any anchor point
      const hit = GP.hitTestPoint(path, ux, uy, thresholdUnits);
      if (hit && hit.part === "anchor") {
        if (e.altKey) {
          // Select entire contour containing anchor
          const contourIdx = GP.findContourIndexForPoint(path, hit.idx);
          setSelectedContour(contourIdx);
          const indices = GP.getContourPointIndices(path, contourIdx);
          setSelectedPoints(new Set(indices));
          dragRef.current = { type: "points", indices, origPath: path, startFont: { x: ux, y: uy }, moved: false };
          return;
        }

        let newSelected: Set<number>;
        if (e.shiftKey) {
          newSelected = new Set(selectedPoints);
          if (newSelected.has(hit.idx)) newSelected.delete(hit.idx);
          else newSelected.add(hit.idx);
        } else {
          newSelected = selectedPoints.has(hit.idx) ? selectedPoints : new Set([hit.idx]);
        }
        setSelectedPoints(newSelected);
        setSelectedContour(null);
        dragRef.current = {
          type: "points",
          indices: Array.from(newSelected),
          origPath: path,
          startFont: { x: ux, y: uy },
          moved: false,
        };
        return;
      }

      // Check hit on a segment (to select contour or start marquee)
      const segHit = GP.hitTestSegment(path, ux, uy, thresholdUnits);
      if (segHit && (e.altKey || e.detail === 2)) {
        const contourIdx = GP.findContourIndexForPoint(path, segHit.segmentIdx);
        setSelectedContour(contourIdx);
        setSelectedPoints(new Set(GP.getContourPointIndices(path, contourIdx)));
        return;
      }

      // Empty space: start marquee selection
      if (!e.shiftKey) {
        setSelectedPoints(new Set());
        setSelectedContour(null);
      }
      dragRef.current = { type: "marquee", startFont: { x: ux, y: uy } };
      setMarqueeRect({ minX: ux, minY: uy, maxX: ux, maxY: uy });
      return;
    }

    // 2. ERASER TOOL
    if (tool === "eraser") {
      dragRef.current = { type: "eraser" };
      performEraserAt(ux, uy);
      return;
    }

    // 3. SHAPE DRAWING TOOLS
    if (tool.startsWith("shape-")) {
      let startX = ux;
      let startY = uy;
      if (snapToGrid) {
        startX = GP.snap(startX, gridSize);
        startY = GP.snap(startY, gridSize);
      }
      dragRef.current = { type: "shape", shapeType: tool, startFont: { x: startX, y: startY } };
      setShapePreview(null);
      setShapeDimensions({ w: 0, h: 0 });
      return;
    }

    // 4. PEN TOOLS (pen, pen-line, pen-curve)
    if (tool === "pen" || tool === "pen-line" || tool === "pen-curve") {
      // Check if closing current open contour
      if (GP.isLastContourOpen(path)) {
        const start = GP.lastContourStartPoint(path);
        if (start && Math.hypot(start.x - ux, start.y - uy) <= thresholdUnits) {
          commit(GP.closeContour(path));
          setIsNearStartPoint(false);
          setRubberBandPoint(null);
          return;
        }
      }

      // Check if clicking on an existing segment to insert an anchor
      if (tool === "pen") {
        const segHit = GP.hitTestSegment(path, ux, uy, thresholdUnits);
        if (segHit) {
          const newPath = GP.splitSegmentAt(path, segHit.segmentIdx, segHit.t);
          commit(newPath);
          setSelectedPoints(new Set([segHit.segmentIdx]));
          return;
        }
      }

      // Start placing or drawing new anchor
      if (!GP.isLastContourOpen(path)) {
        // Start fresh contour
        const newPath = GP.appendMove(path, ux, uy);
        const anchorIdx = newPath.length - 1;
        setLiveOverride(newPath);
        dragRef.current = { type: "pen-drag", anchorIdx, startFont: { x: ux, y: uy }, origPath: newPath };
      } else {
        const prev = GP.lastPoint(path);
        if (!prev) {
          const newPath = GP.appendMove(path, ux, uy);
          setLiveOverride(newPath);
          dragRef.current = { type: "pen-drag", anchorIdx: newPath.length - 1, startFont: { x: ux, y: uy }, origPath: newPath };
          return;
        }

        if (tool === "pen-line") {
          commit(GP.appendLine(path, ux, uy));
        } else if (tool === "pen-curve") {
          const cp1x = prev.x + (ux - prev.x) / 3;
          const cp1y = prev.y + (uy - prev.y) / 3;
          const cp2x = prev.x + ((ux - prev.x) * 2) / 3;
          const cp2y = prev.y + ((uy - prev.y) * 2) / 3;
          commit(GP.appendCurve(path, cp1x, cp1y, cp2x, cp2y, ux, uy));
        } else {
          // "pen" (full interactive pen)
          // Default straight line segment which turns to cubic curve if dragged
          const newPath = GP.appendLine(path, ux, uy);
          const anchorIdx = newPath.length - 1;
          setLiveOverride(newPath);
          dragRef.current = { type: "pen-drag", anchorIdx, startFont: { x: ux, y: uy }, origPath: newPath };
        }
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!containerRef.current || !glyph) return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const fontPos = screenToFont(sx, sy);
    setCursorPos(fontPos);

    let ux = fontPos.x;
    let uy = fontPos.y;
    if (snapToGrid) {
      ux = GP.snap(ux, gridSize);
      uy = GP.snap(uy, gridSize);
    }

    const drag = dragRef.current;

    // Update rubber-band preview when moving around with pen tools
    if (!drag && (tool === "pen" || tool === "pen-line" || tool === "pen-curve")) {
      if (GP.isLastContourOpen(path)) {
        const start = GP.lastContourStartPoint(path);
        const thresholdUnits = HIT_RADIUS_PX / view.zoom;
        if (start && Math.hypot(start.x - ux, start.y - uy) <= thresholdUnits) {
          setIsNearStartPoint(true);
          setRubberBandPoint({ x: start.x, y: start.y });
        } else {
          setIsNearStartPoint(false);
          setRubberBandPoint({ x: ux, y: uy });
        }
      } else {
        setRubberBandPoint(null);
        setIsNearStartPoint(false);
      }
    }

    if (!drag) return;

    // 1. PAN DRAG
    if (drag.type === "pan") {
      setUserAdjustedView(true);
      const dx = e.clientX - drag.startScreen.x;
      const dy = e.clientY - drag.startScreen.y;
      setView((v) => ({ ...v, pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy } }));
      return;
    }

    // 2. MOVING POINTS
    if (drag.type === "points") {
      const dx = ux - drag.startFont.x;
      const dy = uy - drag.startFont.y;
      drag.moved = true;
      setLiveOverride(GP.movePoints(drag.origPath, drag.indices, dx, dy));
      return;
    }

    // 3. MOVING CONTROL HANDLE
    if (drag.type === "handle") {
      const cmd = drag.origPath[drag.cmdIdx];
      if (cmd && cmd.type === "C") {
        const updated = GP.clonePath(drag.origPath);
        const curCmd = updated[drag.cmdIdx] as Extract<PathCommand, { type: "C" }>;
        if (drag.part === "c2") {
          curCmd.x2 = ux;
          curCmd.y2 = uy;
        } else {
          curCmd.x1 = ux;
          curCmd.y1 = uy;
        }
        setLiveOverride(updated);
      }
      return;
    }

    // 4. PEN DRAGGING (PULLING BEZIER HANDLES)
    if (drag.type === "pen-drag") {
      const anchorX = drag.startFont.x;
      const anchorY = drag.startFont.y;
      const dx = ux - anchorX;
      const dy = uy - anchorY;

      const updated = GP.clonePath(drag.origPath);
      const idx = drag.anchorIdx;
      const cmd = updated[idx];

      if (cmd && cmd.type !== "Z") {
        const prev = GP.previousAnchorPoint(updated, idx);
        if (prev) {
          // Convert current segment to cubic curve with pulled handle
          updated[idx] = {
            type: "C",
            x1: Math.round(prev.x + (anchorX - prev.x) / 3),
            y1: Math.round(prev.y + (anchorY - prev.y) / 3),
            x2: Math.round(anchorX - dx),
            y2: Math.round(anchorY - dy),
            x: anchorX,
            y: anchorY,
          };
        }
      }
      setLiveOverride(updated);
      return;
    }

    // 5. SHAPE DRAG PREVIEW
    if (drag.type === "shape") {
      let x1 = drag.startFont.x;
      let y1 = drag.startFont.y;
      let x2 = ux;
      let y2 = uy;

      let w = x2 - x1;
      let h = y2 - y1;

      // Shift key: lock aspect ratio (1:1 square, circle, or 45-deg line)
      if (e.shiftKey) {
        const maxSide = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * maxSide;
        h = Math.sign(h || 1) * maxSide;
        x2 = x1 + w;
        y2 = y1 + h;
      }

      // Alt key: draw from center
      let drawX = Math.min(x1, x2);
      let drawY = Math.min(y1, y2);
      let drawW = Math.abs(w);
      let drawH = Math.abs(h);

      if (e.altKey) {
        drawW *= 2;
        drawH *= 2;
        drawX = x1 - drawW / 2;
        drawY = y1 - drawH / 2;
      }

      setShapeDimensions({ w: Math.round(drawW), h: Math.round(drawH) });

      let previewCmds: PathCommand[] = [];
      if (drag.shapeType === "shape-rect") {
        previewCmds = GP.createRectangle(drawX, drawY, drawW, drawH);
      } else if (drag.shapeType === "shape-circle") {
        previewCmds = GP.createEllipse(drawX + drawW / 2, drawY + drawH / 2, drawW / 2, drawH / 2);
      } else if (drag.shapeType === "shape-triangle") {
        previewCmds = GP.createTriangle(drawX, drawY, drawW, drawH);
      } else if (drag.shapeType === "shape-line") {
        previewCmds = GP.createLine(x1, y1, x2, y2);
      }

      setShapePreview(previewCmds);
      return;
    }

    // 6. MARQUEE SELECTION
    if (drag.type === "marquee") {
      const minX = Math.min(drag.startFont.x, ux);
      const maxX = Math.max(drag.startFont.x, ux);
      const minY = Math.min(drag.startFont.y, uy);
      const maxY = Math.max(drag.startFont.y, uy);
      setMarqueeRect({ minX, minY, maxX, maxY });

      const inRect = GP.findPointsInRect(path, minX, minY, maxX, maxY);
      setSelectedPoints(new Set(inRect));
      return;
    }

    // 7. ERASER DRAG
    if (drag.type === "eraser") {
      performEraserAt(ux, uy);
      return;
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.type === "points") {
      if (drag.moved && liveOverride) commit(liveOverride);
      else setLiveOverride(null);
      return;
    }

    if (drag.type === "handle") {
      if (liveOverride) commit(liveOverride);
      else setLiveOverride(null);
      return;
    }

    if (drag.type === "pen-drag") {
      if (liveOverride) commit(liveOverride);
      else setLiveOverride(null);
      return;
    }

    if (drag.type === "shape") {
      if (shapePreview && shapePreview.length > 0) {
        commit([...path, ...shapePreview]);
      }
      setShapePreview(null);
      setShapeDimensions(null);
      return;
    }

    if (drag.type === "marquee") {
      setMarqueeRect(null);
      return;
    }
  }

  // Double click on anchor: toggle smooth / sharp corner
  function handleDoubleClick(e: React.MouseEvent) {
    if (!containerRef.current || tool !== "select") return;
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: ux, y: uy } = screenToFont(sx, sy);
    const thresholdUnits = HIT_RADIUS_PX / view.zoom;

    const hit = GP.hitTestPoint(path, ux, uy, thresholdUnits);
    if (hit && hit.part === "anchor") {
      commit(GP.togglePointSmooth(path, hit.idx));
    }
  }

  function performEraserAt(ux: number, uy: number) {
    const eraseRadius = ERASER_RADIUS_PX / view.zoom;
    // Check if anchor hit
    const hit = GP.hitTestPoint(path, ux, uy, eraseRadius);
    if (hit && hit.part === "anchor") {
      commit(GP.deletePointAt(path, hit.idx));
      setSelectedPoints(new Set());
      setSelectedContour(null);
      return;
    }

    // Check if segment hit (deletes the contour)
    const segHit = GP.hitTestSegment(path, ux, uy, eraseRadius);
    if (segHit) {
      const contourIdx = GP.findContourIndexForPoint(path, segHit.segmentIdx);
      commit(GP.deleteContourAt(path, contourIdx));
      setSelectedPoints(new Set());
      setSelectedContour(null);
    }
  }

  function getVisibleRect() {
    const tl = screenToFont(0, 0);
    const br = screenToFont(size.w, size.h);
    return {
      minX: Math.min(tl.x, br.x),
      maxX: Math.max(tl.x, br.x),
      minY: Math.min(tl.y, br.y),
      maxY: Math.max(tl.y, br.y),
    };
  }

  if (!project) {
    return <div className="flex-1 bg-[#0e1015]" />;
  }

  const rect = getVisibleRect();
  let g = gridSize;
  while (g > 0 && (rect.maxX - rect.minX) / g > 150) g *= 2;
  const gridLinesX: number[] = [];
  const gridLinesY: number[] = [];
  if (g > 0 && isFinite(rect.minX) && isFinite(rect.maxX)) {
    for (let x = Math.floor(rect.minX / g) * g; x <= rect.maxX; x += g) gridLinesX.push(x);
    for (let y = Math.floor(rect.minY / g) * g; y <= rect.maxY; y += g) gridLinesY.push(y);
  }

  const metricLines = [
    { key: "ascender", y: project.ascender, color: "#60a5fa", label: "Ascender" },
    { key: "capheight", y: project.capHeight, color: "#34d399", label: "Cap Height" },
    { key: "xheight", y: project.xHeight, color: "#fbbf24", label: "X-Height" },
    { key: "baseline", y: 0, color: "#f87171", label: "Baseline" },
    { key: "descender", y: project.descender, color: "#60a5fa", label: "Descender" },
  ];

  const advanceWidth = glyph?.advanceWidth ?? 0;
  const unicodeChar = currentHex ? findUnicodeChar(currentHex) : undefined;
  const pointR = POINT_R_PX / view.zoom;
  const strokeConst = 1 / view.zoom;

  const cursorClass =
    tool === "pan" || spaceDown
      ? "cursor-grab active:cursor-grabbing"
      : tool === "select"
      ? "cursor-default"
      : tool === "eraser"
      ? "cursor-none"
      : "cursor-crosshair";

  const lastAnchor = GP.lastPoint(path);
  const contours = GP.splitContours(path);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <EditorToolbar
        tool={tool}
        setTool={setTool}
        zoom={view.zoom}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onFit={() => {
          setUserAdjustedView(false);
          fitToView();
        }}
        snapToGrid={snapToGrid}
        setSnapToGrid={setSnapToGrid}
        gridSize={gridSize}
        setGridSize={setGridSize}
        onUndo={undo}
        onRedo={redo}
        canUndo={hist.index > 0}
        canRedo={hist.index < hist.stack.length - 1}
        canCloseContour={GP.isLastContourOpen(path)}
        onCloseContour={() => commit(GP.closeContour(path))}
        canDeleteSelection={selectedPoints.size > 0 || selectedContour !== null}
        selectedCount={selectedPoints.size}
        onDeleteSelection={handleDeleteSelection}
        canDeleteContour={selectedContour !== null || selectedPoints.size > 0}
        onDeleteContour={handleDeleteContour}
        hasPaths={path.length > 0}
        onClearAll={handleClearAll}
      />

      {!currentHex || !glyph ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/30">
          Select a glyph from the grid to start editing.
        </div>
      ) : (
        <div
          ref={setContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          className={`glyph-canvas-bg relative flex-1 overflow-hidden select-none ${cursorClass}`}
        >
          {size.w > 0 && size.h > 0 && (
            <svg width={size.w} height={size.h} className="absolute inset-0">
              <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom} ${-view.zoom})`}>
                {/* Grid Lines */}
                {gridLinesX.map((x) => (
                  <line
                    key={`gx${x}`}
                    x1={x}
                    y1={rect.minY}
                    x2={x}
                    y2={rect.maxY}
                    stroke="#ffffff"
                    strokeOpacity={x === 0 ? 0.15 : 0.04}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {gridLinesY.map((y) => (
                  <line
                    key={`gy${y}`}
                    x1={rect.minX}
                    y1={y}
                    x2={rect.maxX}
                    y2={y}
                    stroke="#ffffff"
                    strokeOpacity={y === 0 ? 0.15 : 0.04}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Metric Lines */}
                {metricLines.map((m) => (
                  <line
                    key={m.key}
                    x1={rect.minX}
                    y1={m.y}
                    x2={rect.maxX}
                    y2={m.y}
                    stroke={m.color}
                    strokeOpacity={0.55}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {/* Advance and Origin Lines */}
                <line x1={0} y1={rect.minY} x2={0} y2={rect.maxY} stroke="#a78bfa" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
                <line
                  x1={advanceWidth}
                  y1={rect.minY}
                  x2={advanceWidth}
                  y2={rect.maxY}
                  stroke="#a78bfa"
                  strokeOpacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Selected Contour Glowing Highlight */}
                {selectedContour !== null && contours[selectedContour] && (
                  <path
                    d={GP.contourToSvgD(contours[selectedContour])}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={4 / view.zoom}
                    strokeOpacity={0.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Existing Glyph Path */}
                {path.length > 0 && project.fontMode === "single-line" ? (
                  <path
                    d={GP.pathToSvgD(path)}
                    fill="none"
                    stroke="#7dd3fc"
                    strokeWidth={project.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  path.length > 0 && (
                    <path
                      d={GP.pathToSvgD(path)}
                      fill="rgba(56,189,248,0.25)"
                      stroke="#7dd3fc"
                      strokeWidth={strokeConst}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                )}

                {/* Live Shape Preview (while dragging shape tool) */}
                {shapePreview && shapePreview.length > 0 && (
                  <path
                    d={GP.pathToSvgD(shapePreview)}
                    fill="rgba(56,189,248,0.35)"
                    stroke="#38bdf8"
                    strokeWidth={2 / view.zoom}
                    strokeDasharray={`${6 / view.zoom},${4 / view.zoom}`}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Rubber-band Preview Line/Curve (Pen Tool) */}
                {rubberBandPoint && lastAnchor && GP.isLastContourOpen(path) && (
                  <line
                    x1={lastAnchor.x}
                    y1={lastAnchor.y}
                    x2={rubberBandPoint.x}
                    y2={rubberBandPoint.y}
                    stroke="#38bdf8"
                    strokeOpacity={0.7}
                    strokeWidth={1.5 / view.zoom}
                    strokeDasharray={`${4 / view.zoom},${4 / view.zoom}`}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Snap to close start point indicator */}
                {isNearStartPoint &&
                  (() => {
                    const p = GP.lastContourStartPoint(path);
                    if (!p) return null;
                    return (
                      <g>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={pointR + 5 / view.zoom}
                          fill="rgba(34,197,94,0.25)"
                          stroke="#22c55e"
                          strokeWidth={2.5 / view.zoom}
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })()}

                {/* Marquee Selection Rectangle */}
                {marqueeRect && (
                  <rect
                    x={marqueeRect.minX}
                    y={marqueeRect.minY}
                    width={marqueeRect.maxX - marqueeRect.minX}
                    height={marqueeRect.maxY - marqueeRect.minY}
                    fill="rgba(56,189,248,0.15)"
                    stroke="#38bdf8"
                    strokeWidth={1 / view.zoom}
                    strokeDasharray={`${4 / view.zoom},${3 / view.zoom}`}
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* Path Anchors & Control Handles */}
                {path.map((cmd, idx) => {
                  if (cmd.type === "Z") return null;
                  const isSelected = selectedPoints.has(idx);
                  const elems: React.ReactNode[] = [];

                  // Control handles for selected anchor(s) or active handle
                  if (isSelected || (activeHandle && activeHandle.cmdIdx === idx)) {
                    // Incoming handle (c2 of this C command)
                    if (cmd.type === "C") {
                      elems.push(
                        <line
                          key={`in-h-${idx}`}
                          x1={cmd.x}
                          y1={cmd.y}
                          x2={cmd.x2}
                          y2={cmd.y2}
                          stroke="#f59e0b"
                          strokeOpacity={0.85}
                          strokeWidth={1 / view.zoom}
                          vectorEffect="non-scaling-stroke"
                        />,
                        <circle
                          key={`in-c-${idx}`}
                          cx={cmd.x2}
                          cy={cmd.y2}
                          r={pointR * 0.8}
                          fill="#f59e0b"
                          stroke="#0b0d12"
                          strokeWidth={strokeConst}
                        />
                      );
                    }

                    // Outgoing handle (c1 of the next C command)
                    if (idx + 1 < path.length && path[idx + 1].type === "C") {
                      const nextCmd = path[idx + 1] as Extract<PathCommand, { type: "C" }>;
                      elems.push(
                        <line
                          key={`out-h-${idx}`}
                          x1={cmd.x}
                          y1={cmd.y}
                          x2={nextCmd.x1}
                          y2={nextCmd.y1}
                          stroke="#f59e0b"
                          strokeOpacity={0.85}
                          strokeWidth={1 / view.zoom}
                          vectorEffect="non-scaling-stroke"
                        />,
                        <circle
                          key={`out-c-${idx}`}
                          cx={nextCmd.x1}
                          cy={nextCmd.y1}
                          r={pointR * 0.8}
                          fill="#f59e0b"
                          stroke="#0b0d12"
                          strokeWidth={strokeConst}
                        />
                      );
                    }
                  }

                  // Anchor point circle
                  elems.push(
                    <circle
                      key={`a-${idx}`}
                      cx={cmd.x}
                      cy={cmd.y}
                      r={isSelected ? pointR + 1 / view.zoom : pointR}
                      fill={isSelected ? "#38bdf8" : cmd.type === "M" ? "#4ade80" : "#e5e7eb"}
                      stroke={isSelected ? "#ffffff" : "#0b0d12"}
                      strokeWidth={isSelected ? 1.5 / view.zoom : strokeConst}
                    />
                  );

                  return elems;
                })}

                {/* Eraser Visual Ring */}
                {tool === "eraser" && cursorPos && (
                  <circle
                    cx={cursorPos.x}
                    cy={cursorPos.y}
                    r={ERASER_RADIUS_PX / view.zoom}
                    fill="rgba(239,68,68,0.2)"
                    stroke="#ef4444"
                    strokeWidth={1.5 / view.zoom}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            </svg>
          )}

          {/* HUD Dimensions Tooltip when drawing shapes */}
          {shapeDimensions && shapeDimensions.w > 0 && cursorPos && (
            <div
              style={{
                position: "absolute",
                left: fontToScreen(cursorPos.x, cursorPos.y).sx + 14,
                top: fontToScreen(cursorPos.x, cursorPos.y).sy + 14,
              }}
              className="pointer-events-none rounded bg-black/80 px-2 py-1 text-[11px] font-mono text-sky-300 shadow"
            >
              {shapeDimensions.w} × {shapeDimensions.h} px
            </div>
          )}

          {/* Metric labels & unicode badge */}
          <div className="pointer-events-none absolute inset-0">
            {metricLines.map((m) => {
              const sy = view.pan.y - m.y * view.zoom;
              return (
                <div
                  key={m.key}
                  style={{ position: "absolute", left: 6, top: sy - 8 }}
                  className="select-none whitespace-nowrap rounded bg-black/50 px-1 text-[10px] text-white/50"
                >
                  {m.label} · {m.y}
                </div>
              );
            })}
            {unicodeChar && (
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-white/50">
                U+{unicodeChar.hex} &middot; {unicodeChar.name} &middot; adv {advanceWidth}
                {selectedPoints.size > 0 && (
                  <span className="ml-2 text-sky-400 font-medium">
                    ({selectedPoints.size} point{selectedPoints.size === 1 ? "" : "s"} selected)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
