"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Settings2, ChevronDown, Loader2, Type, Upload } from "lucide-react";
import { useProjectStore } from "@/lib/projectStore";
import { exportFont, ExportFormat } from "@/lib/fontExport";
import { importFontFile } from "@/lib/fontImport";
import { db } from "@/lib/db";
import ProjectSettingsDialog from "./ProjectSettingsDialog";
import { useLanguage } from "@/components/providers/AppProviders";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";

export default function TopBar() {
  const router = useRouter();
  const { t } = useLanguage();
  const project = useProjectStore((s) => s.project);
  const glyphs = useProjectStore((s) => s.glyphs);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
    { id: "otf", label: t.editor.exportOtf, hint: t.editor.exportOtfHint },
    { id: "woff", label: t.editor.exportWoff, hint: t.editor.exportWoffHint },
    { id: "woff2", label: t.editor.exportWoff2, hint: t.editor.exportWoff2Hint },
  ];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!project) return null;
  const drawnCount = Object.values(glyphs).filter((g) => g.path.length > 0).length;

  async function handleExport(format: ExportFormat) {
    setShowExport(false);
    setExportError(null);
    if (drawnCount === 0) {
      setExportError("Draw at least one glyph before exporting.");
      return;
    }
    setExporting(format);
    try {
      await exportFont(project!, Object.values(glyphs), format);
    } catch (e) {
      console.error(e);
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  async function handleReimport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    setReimporting(true);
    setExportError(null);
    try {
      const result = await importFontFile(file, project.id);
      await db.putProject(result.project);
      await db.putGlyphs(result.glyphs);
      await loadProject(project.id);
    } catch (err) {
      console.error(err);
      setExportError(err instanceof Error ? err.message : "Failed to re-import font.");
    } finally {
      setReimporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 transition-colors dark:border-white/10 dark:bg-[#101217]">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/")}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white transition"
          title={t.editor.backToHome}
        >
          <ArrowLeft size={16} />
        </button>
        <Type size={16} className="text-sky-600 dark:text-sky-400" />
        <input
          value={project.name}
          onChange={(e) => updateProjectMeta({ name: e.target.value })}
          className="rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-slate-900 outline-none hover:bg-slate-100 focus:bg-slate-100 dark:text-white/90 dark:hover:bg-white/5 dark:focus:bg-white/5"
        />
        <span className="text-xs text-slate-400 dark:text-white/30">v{project.version}</span>
      </div>

      <div className="flex items-center gap-2">
        {exportError && <span className="text-xs text-red-500 dark:text-red-400">{exportError}</span>}
        <span className="text-[11px] text-slate-500 dark:text-white/30">
          {drawnCount} {t.editor.glyphsDrawn}
        </span>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleReimport}
          accept=".ttf,.otf,.woff"
          className="hidden"
        />

        {/* Language Switcher */}
        <LanguageSelector />

        {/* Theme Toggle */}
        <ThemeToggle />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={reimporting}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50 transition dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
          title="Re-import font file into this project"
        >
          {reimporting ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          <span className="hidden sm:inline">{t.editor.reimport}</span>
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white transition"
          title={t.editor.settings}
        >
          <Settings2 size={16} />
        </button>

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExport((v) => !v)}
            disabled={!!exporting}
            className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60 shadow-sm"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {t.editor.export}
            <ChevronDown size={13} />
          </button>
          {showExport && (
            <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#191c22]">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleExport(f.id)}
                  className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-white/10 transition"
                >
                  <span className="text-xs font-medium text-slate-900 dark:text-white/90">{f.label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-white/40">{f.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && <ProjectSettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}
