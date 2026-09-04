"use client";

import {
  MousePointer2,
  PenTool,
  Minus,
  Spline,
  Square,
  Circle,
  Triangle,
  Eraser,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Magnet,
  Trash2,
  CornerDownLeft,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { ToolId } from "@/lib/types";

const MAIN_TOOLS: { id: ToolId; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select (V) · Click point, drag box to multi-select, Alt-click contour", icon: MousePointer2 },
  { id: "pen", label: "Pen Tool (P) · Click for line, drag for curve handles", icon: PenTool },
  { id: "pen-line", label: "Line Pen (L) · Straight lines only", icon: Minus },
  { id: "pen-curve", label: "Curve Pen (C) · Auto curves", icon: Spline },
];

const SHAPE_TOOLS: { id: ToolId; label: string; icon: typeof Square }[] = [
  { id: "shape-rect", label: "Rectangle (R) · Shift: Square, Alt: From center", icon: Square },
  { id: "shape-circle", label: "Circle / Ellipse (O) · Shift: Circle, Alt: From center", icon: Circle },
  { id: "shape-triangle", label: "Triangle (T) · Drag to draw", icon: Triangle },
  { id: "shape-line", label: "Line · Shift: Snap 45°", icon: Minus },
];

function ToolbarButton({
  onClick,
  disabled,
  title,
  active,
  badge,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  badge?: number | string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        "relative flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white/90",
        active && !danger && "bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 hover:text-sky-800 ring-1 ring-sky-500/40 dark:bg-sky-500/20 dark:text-sky-400 dark:hover:text-sky-300",
        active && danger && "bg-red-500/15 text-red-600 hover:bg-red-500/25 ring-1 ring-red-500/40 dark:bg-red-500/20 dark:text-red-400",
        danger && !active && "hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
      )}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-black">
          {badge}
        </span>
      )}
    </button>
  );
}

export default function EditorToolbar({
  tool,
  setTool,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  snapToGrid,
  setSnapToGrid,
  gridSize,
  setGridSize,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  canCloseContour,
  onCloseContour,
  canDeleteSelection,
  onDeleteSelection,
  selectedCount = 0,
  canDeleteContour = false,
  onDeleteContour,
  hasPaths = false,
  onClearAll,
}: {
  tool: ToolId;
  setTool: (t: ToolId) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;
  gridSize: number;
  setGridSize: (v: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canCloseContour: boolean;
  onCloseContour: () => void;
  canDeleteSelection: boolean;
  onDeleteSelection: () => void;
  selectedCount?: number;
  canDeleteContour?: boolean;
  onDeleteContour?: () => void;
  hasPaths?: boolean;
  onClearAll?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-[#14161c]">
      {/* Primary Tools */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 dark:border-white/10">
        {MAIN_TOOLS.map((t) => (
          <ToolbarButton
            key={t.id}
            title={t.label}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
          >
            <t.icon size={16} />
          </ToolbarButton>
        ))}
      </div>

      {/* Shape Tools */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5 dark:border-white/10">
        <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase px-1 hidden sm:inline dark:text-white/30">
          Shapes
        </span>
        {SHAPE_TOOLS.map((s) => (
          <ToolbarButton
            key={s.id}
            title={s.label}
            active={tool === s.id}
            onClick={() => setTool(s.id)}
          >
            <s.icon size={15} />
          </ToolbarButton>
        ))}
      </div>

      {/* Eraser & Pan */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5 dark:border-white/10">
        <ToolbarButton
          title="Eraser (E) · Click or drag to erase points or contours"
          active={tool === "eraser"}
          onClick={() => setTool("eraser")}
        >
          <Eraser size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Pan (Space / H)"
          active={tool === "pan"}
          onClick={() => setTool("pan")}
        >
          <Hand size={16} />
        </ToolbarButton>
      </div>

      {/* Contour & Deletion Controls */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5 dark:border-white/10">
        <ToolbarButton
          title="Close open contour (Enter)"
          disabled={!canCloseContour}
          onClick={onCloseContour}
        >
          <CornerDownLeft size={16} />
        </ToolbarButton>

        <ToolbarButton
          title={
            selectedCount > 1
              ? `Delete ${selectedCount} selected points (Del / Backspace)`
              : "Delete selected point (Del / Backspace)"
          }
          disabled={!canDeleteSelection}
          badge={selectedCount > 1 ? selectedCount : undefined}
          danger
          onClick={onDeleteSelection}
        >
          <Trash2 size={16} />
        </ToolbarButton>

        {onDeleteContour && (
          <ToolbarButton
            title="Delete selected contour / shape"
            disabled={!canDeleteContour}
            danger
            onClick={onDeleteContour}
          >
            <XCircle size={16} />
          </ToolbarButton>
        )}

        {onClearAll && (
          <button
            onClick={onClearAll}
            disabled={!hasPaths}
            title="Clear all paths in this glyph"
            className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent dark:text-red-400/80 dark:hover:bg-red-500/15 dark:hover:text-red-300"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5 dark:border-white/10">
        <ToolbarButton title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 px-1.5 dark:border-white/10">
        <ToolbarButton title="Zoom out (-)" onClick={onZoomOut}>
          <ZoomOut size={16} />
        </ToolbarButton>
        <span className="w-11 text-center text-xs tabular-nums text-slate-500 dark:text-white/50">
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarButton title="Zoom in (+ / =)" onClick={onZoomIn}>
          <ZoomIn size={16} />
        </ToolbarButton>
        <ToolbarButton title="Fit to view (0)" onClick={onFit}>
          <Maximize2 size={16} />
        </ToolbarButton>
      </div>

      {/* Grid & Snapping */}
      <div className="flex items-center gap-1.5 px-1.5">
        <ToolbarButton
          title="Snap to grid"
          active={snapToGrid}
          onClick={() => setSnapToGrid(!snapToGrid)}
        >
          <Magnet size={16} />
        </ToolbarButton>
        <input
          type="number"
          value={gridSize}
          onChange={(e) => setGridSize(Math.max(1, Number(e.target.value) || 1))}
          className="h-8 w-14 rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-black/30 dark:text-white/70"
          title="Grid size (font units)"
        />
      </div>
    </div>
  );
}
