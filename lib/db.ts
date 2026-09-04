import { openDB, DBSchema, IDBPDatabase } from "idb";
import { FontProject, GlyphRecord } from "./types";

interface KFCSchema extends DBSchema {
  projects: {
    key: string;
    value: FontProject;
  };
  glyphs: {
    key: string;
    value: GlyphRecord;
    indexes: { byProject: string };
  };
}

const DB_NAME = "kfonts-creator";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<KFCSchema>> | null = null;

function getDb() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<KFCSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("glyphs")) {
          const store = db.createObjectStore("glyphs", { keyPath: "id" });
          store.createIndex("byProject", "projectId");
        }
      },
    });
  }
  return dbPromise;
}

export const db = {
  async listProjects(): Promise<FontProject[]> {
    const database = await getDb();
    const all = await database.getAll("projects");
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async getProject(id: string): Promise<FontProject | undefined> {
    const database = await getDb();
    return database.get("projects", id);
  },
  async putProject(project: FontProject): Promise<void> {
    const database = await getDb();
    await database.put("projects", project);
  },
  async deleteProject(id: string): Promise<void> {
    const database = await getDb();
    const tx = database.transaction(["projects", "glyphs"], "readwrite");
    await tx.objectStore("projects").delete(id);
    const glyphIndex = tx.objectStore("glyphs").index("byProject");
    let cursor = await glyphIndex.openCursor(IDBKeyRange.only(id));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  },
  async listGlyphs(projectId: string): Promise<GlyphRecord[]> {
    const database = await getDb();
    return database.getAllFromIndex("glyphs", "byProject", projectId);
  },
  async putGlyph(glyph: GlyphRecord): Promise<void> {
    const database = await getDb();
    await database.put("glyphs", glyph);
  },
  async putGlyphs(glyphs: GlyphRecord[]): Promise<void> {
    const database = await getDb();
    const tx = database.transaction("glyphs", "readwrite");
    await Promise.all(glyphs.map((g) => tx.store.put(g)));
    await tx.done;
  },
  async deleteGlyph(id: string): Promise<void> {
    const database = await getDb();
    await database.delete("glyphs", id);
  },
};
