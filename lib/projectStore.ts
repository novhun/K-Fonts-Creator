import { create } from "zustand";
import { FontMode, FontProject, GlyphRecord, PathCommand } from "./types";
import { db } from "./db";
import { defaultGlyphRecord, makeGlyphId } from "./glyphPath";
import { debounce } from "./debounce";
import { convertGlyphPath } from "./modeConvert";

interface ProjectStoreState {
  project: FontProject | null;
  glyphs: Record<string, GlyphRecord>; // key: unicode hex
  currentHex: string | null;
  loading: boolean;
  converting: boolean;

  loadProject: (id: string) => Promise<void>;
  updateProjectMeta: (partial: Partial<FontProject>) => void;
  selectGlyph: (hex: string, defaultAdvanceWidth: number) => void;
  getOrCreateGlyph: (hex: string, defaultAdvanceWidth: number) => GlyphRecord;
  updateGlyphPath: (hex: string, path: PathCommand[]) => void;
  updateGlyphMeta: (hex: string, partial: Partial<Pick<GlyphRecord, "advanceWidth" | "leftSideBearing" | "name">>) => void;
  deleteGlyph: (hex: string) => void;
  convertFontMode: (newMode: FontMode) => Promise<void>;
}

const persistProject = debounce((project: FontProject) => {
  db.putProject(project);
}, 400);

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: null,
  glyphs: {},
  currentHex: null,
  loading: false,
  converting: false,

  async loadProject(id: string) {
    set({ loading: true });
    const [project, glyphList] = await Promise.all([db.getProject(id), db.listGlyphs(id)]);
    const glyphs: Record<string, GlyphRecord> = {};
    for (const g of glyphList) glyphs[g.unicode] = g;
    set({ project: project ?? null, glyphs, loading: false, currentHex: null });
  },

  updateProjectMeta(partial) {
    const { project } = get();
    if (!project) return;
    const updated = { ...project, ...partial, updatedAt: Date.now() };
    set({ project: updated });
    persistProject(updated);
  },

  selectGlyph(hex, defaultAdvanceWidth) {
    get().getOrCreateGlyph(hex, defaultAdvanceWidth);
    set({ currentHex: hex });
  },

  getOrCreateGlyph(hex, defaultAdvanceWidth) {
    const { project, glyphs } = get();
    if (!project) throw new Error("No project loaded");
    if (glyphs[hex]) return glyphs[hex];
    const record = defaultGlyphRecord(project.id, hex, defaultAdvanceWidth);
    set({ glyphs: { ...glyphs, [hex]: record } });
    return record;
  },

  updateGlyphPath(hex, path) {
    const { project, glyphs } = get();
    if (!project) return;
    const existing = glyphs[hex] ?? defaultGlyphRecord(project.id, hex, Math.round(project.unitsPerEm * 0.5));
    const updated: GlyphRecord = { ...existing, path, updatedAt: Date.now() };
    set({ glyphs: { ...glyphs, [hex]: updated } });
    db.putGlyph(updated);
    get().updateProjectMeta({});
  },

  updateGlyphMeta(hex, partial) {
    const { project, glyphs } = get();
    if (!project) return;
    const existing = glyphs[hex] ?? defaultGlyphRecord(project.id, hex, Math.round(project.unitsPerEm * 0.5));
    const updated: GlyphRecord = { ...existing, ...partial, updatedAt: Date.now() };
    set({ glyphs: { ...glyphs, [hex]: updated } });
    db.putGlyph(updated);
  },

  deleteGlyph(hex) {
    const { project, glyphs } = get();
    if (!project) return;
    const existing = glyphs[hex];
    if (!existing) return;
    const rest = { ...glyphs };
    delete rest[hex];
    set({ glyphs: rest });
    db.deleteGlyph(makeGlyphId(project.id, hex));
  },

  async convertFontMode(newMode) {
    const { project, glyphs } = get();
    if (!project || project.fontMode === newMode) return;
    set({ converting: true });
    try {
      const upe = project.unitsPerEm || 1000;
      const dotSpacing = project.dotSpacing || Math.round(upe * 0.045);
      const dotRadius = project.dotRadius || Math.max(1, Math.round(dotSpacing * 0.38));
      const strokeWidth = project.strokeWidth || Math.round(upe * 0.04);

      const params = {
        strokeWidth,
        dotSpacing,
        dotRadius,
        unitsPerEm: upe,
      };

      const updatedGlyphs: Record<string, GlyphRecord> = { ...glyphs };
      const entries = Object.entries(glyphs).filter(([_, g]) => g.path.length > 0);
      let count = 0;
      for (const [hex, glyph] of entries) {
        const newPath = convertGlyphPath(glyph.path, project.fontMode, newMode, params);
        updatedGlyphs[hex] = { ...glyph, path: newPath, updatedAt: Date.now() };
        count++;
        if (count % 8 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      const updatedProject: FontProject = {
        ...project,
        fontMode: newMode,
        dotSpacing,
        dotRadius,
        strokeWidth,
        updatedAt: Date.now(),
      };
      set({ glyphs: updatedGlyphs, project: updatedProject });
      await db.putProject(updatedProject);
      await db.putGlyphs(Object.values(updatedGlyphs).filter((g) => g.path.length > 0));
    } finally {
      set({ converting: false });
    }
  },
}));
