# K Fonts Creator

A local-first, browser-based font editor built with Next.js. Draw glyphs for Basic Latin
and Khmer Unicode ranges, map them to code points, preview them live, and export a
working web font — all client-side, no backend, no server-side font processing.

Three glyph styles are supported per project:
- **Outline** — ordinary filled glyphs, for a standard text font.
- **Single-Line** — open centerline strokes (no fill), for engraving, laser-cutting,
  and pen-plotter fonts. Drawn with the same pen tools as outline mode; at export/preview
  time the stroke is expanded into a thin filled outline (via `clipper-lib`'s path
  offsetting) so it still ships as a normal, valid OTF/WOFF/WOFF2 file.
- **Dot Matrix** — a grid of round dots sampled over the filled shape, in the style of
  fonts like Doto or Open Khmer School Dotted. Each dot is its own small closed circle,
  so (unlike single-line) it needs no export-time transform — it's already a normal,
  directly-editable filled glyph, and every dot can be moved/added/erased by hand.

A project's style can be converted after the fact from Font Settings, which transforms
every already-drawn glyph (asks for confirmation first — it's irreversible):
- **→ Outline** is exact — reuses the same stroke/dot-to-fill logic as export.
- **→ Dot Matrix** is exact — samples a dot grid over the filled shape.
- **→ Single-Line** approximates a centerline skeleton (rasterize → Zhang-Suen thinning
  → trace → simplify). This is inherently best-effort: simple letterforms convert
  cleanly, but a sharp, symmetric junction (three strokes meeting at one point, like a
  triangle) can still drop or shorten a branch. Review the result and finish it by hand
  with the pen/eraser tools if needed.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000. All data (projects, glyphs) is stored in the browser's
IndexedDB — nothing is sent to a server, and everything works offline after the first load.

## Key packages and why they're used

| Package | Purpose |
|---|---|
| `opentype.js` | Parses imported `.ttf/.otf/.woff` files and builds the exported font binary (CFF-flavored OpenType) from drawn glyph outlines. |
| `idb` | Thin Promise wrapper around IndexedDB for local persistence (projects + glyphs). |
| `zustand` | Lightweight global state for the current project/glyph, shared between the grid, canvas, mapping panel, and preview. |
| `lucide-react` | Icon set used throughout the toolbar and UI. |
| `wawoff2` | Optional WOFF2 (Brotli) compression for export. Runs as WASM in the browser; wrapped with a timeout since WASM init can occasionally hang in restrictive sandboxes — OTF/WOFF exports don't depend on it and always work. |
| `clipper-lib` | Expands single-line stroke centerlines into filled outlines at export/preview time (round joins/caps), so single-line glyphs export through the same font pipeline as outline glyphs. |
| _(no extra package)_ | Dot-matrix conversion and outline skeletonization both rasterize via a plain `<canvas>` (already in the browser) rather than a new dependency. |
| `clsx` | Small conditional className helper. |

## Architecture

```
app/
  page.tsx                    Dashboard: create/import/delete projects
  project/[id]/page.tsx       Editor route
components/
  dashboard/                  New-project and font-import dialogs, project cards
  editor/
    EditorShell.tsx           Loads the project, lays out the 3-pane workspace
    TopBar.tsx                Project name, font settings, export menu
    GlyphGrid.tsx             Basic Latin + Khmer glyph grid with drawn/undrawn status
    GlyphEditorCanvas.tsx     SVG vector editor: pen/line tools, grid, metrics, zoom/pan
    EditorToolbar.tsx         Tool selection, undo/redo, zoom, snap-to-grid
    MappingPanel.tsx          Unicode code point, glyph name, advance width / side bearings
    PreviewPanel.tsx          Live text preview using a dynamically-built @font-face
  ui/                         Small shared Modal/Field primitives
lib/
  types.ts                    FontProject / GlyphRecord / PathCommand types
  db.ts                       IndexedDB access (projects + glyphs stores)
  projectStore.ts             Zustand store wiring state <-> IndexedDB
  unicodeRanges.ts             Basic Latin + Khmer block definitions (consonants,
                               independent/dependent vowels, signs incl. COENG, digits)
  glyphPath.ts                Path-editing helpers: hit-testing, point move/delete,
                               contour open/close, SVG `d` conversion
  fontImport.ts                .ttf/.otf/.woff -> project + glyphs
  fontExport.ts                glyphs -> OTF (opentype.js) -> WOFF / WOFF2
  fontPreview.ts               Builds an in-memory font for the live preview
  woffPack.ts                  Minimal WOFF1 packager (zlib via CompressionStream)
  skeletonize.ts               Outline -> single-line stroke (best-effort skeleton)
  strokeToOutline.ts            Single-line stroke -> filled outline (clipper-lib)
  dotMatrix.ts                 Filled outline -> dot-matrix pattern
  modeConvert.ts                Dispatches the right conversion for any style pair
```

## Glyph path format

Glyph outlines are stored as flat arrays of opentype.js-compatible path commands
(`M`/`L`/`C`/`Q`/`Z`, in font units) — the same shape opentype.js itself uses, so
import and export need no conversion. The editor's pen tools produce cubic (`C`)
curves; opentype.js's CFF writer natively supports cubic curves (and even converts
quadratics), so no lossy curve conversion happens on export.

## Editor shortcuts

`V` select · `L` line pen · `C` curve pen · `E` eraser · `Space`+drag or middle-click
to pan · scroll to zoom · `Enter` closes the open contour · `Delete` removes the
selected point · `Ctrl/Cmd+Z` undo, `+Shift` redo · `0` fits the view.

## Character coverage

Basic Latin (incl. NBSP/«/») plus the full Khmer block used by real Khmer fonts:
consonants, independent/dependent vowels, signs (incl. COENG), digits, and
punctuation (KHAN, BARIYOOSAN, the Riel currency sign, etc.) — 203 code points in
total, matching the coverage of a font like Battambang.

## Known limitations

- **Export formats**: produces OpenType-CFF (`.otf`, cubic curves preserved exactly),
  `.woff` (always available, built with a small in-repo packager), and `.woff2`
  (best-effort — requires WASM Brotli via `wawoff2`, which can time out in some
  restrictive/sandboxed browsers; OTF/WOFF remain the always-reliable options).
- **Khmer complex shaping**: this editor draws and maps individual glyph outlines.
  It does not yet generate OpenType layout tables (GSUB/GPOS), so behavior that
  depends on them — subscript-consonant stacking under the COENG sign, vowel
  reordering — will not render correctly even though each glyph shape itself is
  correct in isolation. Basic Latin text and standalone Khmer glyphs preview and
  export correctly.
