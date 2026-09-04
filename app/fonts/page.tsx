"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Type, Copy, Check, ChevronDown, ChevronUp, BookOpen,
  Search, X, Download, Filter, SlidersHorizontal, Globe,
  Languages, ArrowUpDown, RefreshCw, AlertCircle, Loader2,
  Folder, FolderOpen, ChevronRight,
} from "lucide-react";
import type { FontFamilyMeta, FontsApiResponse, FolderNode } from "@/app/api/fonts/route";
import { useLanguage } from "@/components/providers/AppProviders";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fontFileUrl(relativePath: string) {
  return `/api/font-file/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function faceId(familyId: string, fileName: string) {
  return `dyn-${familyId}-${fileName.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

function buildFontFace(family: FontFamilyMeta, variant: { fileName: string; relativePath: string; weight: number; italic: boolean }) {
  const id = faceId(family.id, variant.fileName);
  const url = fontFileUrl(variant.relativePath);
  return `@font-face {
  font-family: '${id}';
  src: url('${url}');
  font-weight: 100 1000;
  font-style: oblique 0deg 90deg;
  font-display: swap;
}
@font-face {
  font-family: '${id}';
  src: url('${url}');
  font-weight: ${variant.weight};
  font-style: ${variant.italic ? "italic" : "normal"};
  font-display: swap;
}`;
}

function buildCssSnippet(family: FontFamilyMeta, variant: { fileName: string; relativePath: string; weight: number; italic: boolean; isVariable: boolean }) {
  const range = variant.isVariable ? " 100 900" : "";
  return `@font-face {\n  font-family: '${family.family}';\n  src: url('${fontFileUrl(variant.relativePath)}');\n  font-weight: ${variant.weight}${range};\n  font-style: ${variant.italic ? "italic" : "normal"};\n}`;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const LANG_COLORS: Record<string, string> = {
  "khmer+latin": "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  khmer:         "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  latin:         "border-sky-500/30   bg-sky-500/10   text-sky-600 dark:text-sky-400",
  other:         "border-slate-300 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/40",
};

const KHMER_SAMPLES = [
  "អក្សរខ្មែរ ស្រស់ស្អាត ជាភាសារបស់ជនជាតិខ្មែរ",
  "ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឋ ឌ ឍ ណ",
  "ភាសាខ្មែរ គឺជាភាសាដែលមានប្រវត្តិវប្បធម៌យូរអង្វែង",
];
const LATIN_SAMPLES = [
  "The quick brown fox jumps over the lazy dog.",
  "Sphinx of black quartz, judge my vow. ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "Typography is the art and technique of arranging type.",
];

type SortValue = "name-asc" | "name-desc" | "variants-desc";

// ─── FolderTree component ────────────────────────────────────────────────────

function FolderTreeItem({
  node,
  depth,
  activeFolder,
  onSelect,
  onDownload,
  downloadingFolder,
}: {
  node: FolderNode;
  depth: number;
  activeFolder: string | null;
  onSelect: (path: string | null) => void;
  onDownload: (path: string, name: string, count: number) => void;
  downloadingFolder: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isActive = activeFolder === node.relativePath;
  const hasChildren = node.children.length > 0;
  const isDownloading = !!downloadingFolder[node.relativePath];

  return (
    <div>
      <div
        className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs font-medium mx-1 transition cursor-pointer ${
          isActive
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold"
            : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white/90"
        }`}
        style={{ paddingLeft: `${depth * 10 + 8}px` }}
        onClick={() => onSelect(isActive ? null : node.relativePath)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white"
            >
              <ChevronDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
          ) : (
            <span className="w-3" />
          )}
          {isActive ? (
            <FolderOpen size={12} className="text-amber-500 flex-shrink-0" />
          ) : (
            <Folder size={12} className="text-amber-500/70 flex-shrink-0" />
          )}
          <span className="truncate text-[11px]">{node.name}</span>
        </div>

        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 flex-shrink-0">
          <span className="text-[10px] text-slate-400 dark:text-white/30 font-mono tabular-nums">
            {node.fontCount}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(node.relativePath, node.name, node.fontCount);
            }}
            disabled={isDownloading}
            title={`Download ${node.name} (${node.fontCount} fonts)`}
            className="p-0.5 rounded text-slate-400 hover:text-emerald-600 dark:text-white/30 dark:hover:text-emerald-400"
          >
            {isDownloading ? (
              <Loader2 size={10} className="animate-spin text-emerald-500" />
            ) : (
              <Download size={10} />
            )}
          </button>
        </div>
      </div>

      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.relativePath}
              node={child}
              depth={depth + 1}
              activeFolder={activeFolder}
              onSelect={onSelect}
              onDownload={onDownload}
              downloadingFolder={downloadingFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FontsPage() {
  const { t } = useLanguage();
  const [families, setFamilies] = useState<FontFamilyMeta[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>("name-asc");
  const [customText, setCustomText] = useState("");
  const [previewSize, setPreviewSize] = useState(26);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // UI state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadingFolder, setDownloadingFolder] = useState<Record<string, boolean>>({});

  const styleRef = useRef<HTMLStyleElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const SORT_OPTIONS = [
    { value: "name-asc", label: t.library.sortName },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "variants-desc", label: t.library.sortVariants },
  ];

  const fetchFonts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fonts", { cache: "no-store" });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data: FontsApiResponse = await res.json();
      setFamilies(data.families);
      setFolderTree(data.folderTree ?? []);
      setScannedAt(data.scannedAt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  // Poll every 5 s for new fonts
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/fonts", { cache: "no-store" });
        if (!res.ok) return;
        const data: FontsApiResponse = await res.json();
        setFamilies((prev) => {
          const oldIds = prev.map((f) => f.id).join(",");
          const newIds = data.families.map((f) => f.id).join(",");
          if (oldIds !== newIds) {
            setScannedAt(data.scannedAt);
            setFolderTree(data.folderTree ?? []);
            return data.families;
          }
          return prev;
        });
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Inject @font-face
  useEffect(() => {
    styleRef.current?.remove();
    const style = document.createElement("style");
    style.textContent = families
      .flatMap((f) => f.variants.map((v) => buildFontFace(f, v)))
      .join("\n");
    document.head.appendChild(style);
    styleRef.current = style;
    return () => style.remove();
  }, [families]);

  // Derived
  const totalVariants = useMemo(
    () => families.reduce((s, f) => s + f.variants.length, 0),
    [families]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return families
      .filter((f) => {
        const matchSearch =
          !q ||
          f.family.toLowerCase().includes(q) ||
          f.language.includes(q) ||
          f.folder.toLowerCase().includes(q);
        const matchLang =
          langFilter === "all" ||
          f.language === langFilter ||
          f.language.startsWith(langFilter);
        const matchFolder =
          !activeFolder ||
          f.variants.some(
            (v) =>
              v.relativePath === activeFolder ||
              v.relativePath.startsWith(activeFolder + "/")
          );
        return matchSearch && matchLang && matchFolder;
      })
      .sort((a, b) => {
        if (sort === "name-desc") return b.family.localeCompare(a.family);
        if (sort === "variants-desc")
          return b.variants.length - a.variants.length;
        return a.family.localeCompare(b.family);
      });
  }, [families, search, langFilter, activeFolder, sort]);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((p) => ({ ...p, [key]: true }));
      setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000);
    });
  }

  function toggleExpand(id: string) {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function downloadVariant(relativePath: string, fileName: string, key: string) {
    setDownloading((p) => ({ ...p, [key]: true }));
    const a = document.createElement("a");
    a.href = fontFileUrl(relativePath);
    a.download = fileName;
    a.click();
    setTimeout(() => setDownloading((p) => ({ ...p, [key]: false })), 1500);
  }

  function downloadAll(family: FontFamilyMeta) {
    const key = `all-${family.id}`;
    setDownloading((p) => ({ ...p, [key]: true }));
    family.variants.forEach((v, i) =>
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = fontFileUrl(v.relativePath);
        a.download = v.fileName;
        a.click();
      }, i * 400)
    );
    setTimeout(
      () => setDownloading((p) => ({ ...p, [key]: false })),
      family.variants.length * 400 + 600
    );
  }

  async function downloadFolder(folderPath: string, folderName: string, count: number) {
    setDownloadingFolder((p) => ({ ...p, [folderPath]: true }));
    try {
      const res = await fetch(
        `/api/fonts/download-folder?folder=${encodeURIComponent(folderPath)}`
      );
      if (!res.ok) throw new Error("Folder download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${folderName.replace(/\s+/g, "_")}_fonts.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert("Error downloading folder: " + (e as Error).message);
    } finally {
      setDownloadingFolder((p) => ({ ...p, [folderPath]: false }));
    }
  }

  function getSample(font: FontFamilyMeta, type: "khmer" | "en") {
    if (customText) return customText;
    if (type === "khmer")
      return KHMER_SAMPLES[sampleIdx % KHMER_SAMPLES.length];
    return LATIN_SAMPLES[sampleIdx % LATIN_SAMPLES.length];
  }

  const activeFilterCount =
    (langFilter !== "all" ? 1 : 0) + (activeFolder ? 1 : 0);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col transition-colors duration-200 dark:bg-[#0b0d12] dark:text-white">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md flex-shrink-0 dark:border-white/8 dark:bg-[#0d0f15]/90">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 shadow-sm group-hover:bg-sky-500/20 transition dark:from-sky-500/20 dark:to-violet-500/20 dark:text-sky-400">
              <Type size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {t.nav.appTitle}
                </span>
                <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                  {t.nav.library}
                </span>
              </div>
            </div>
          </Link>

          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.library.searchPlaceholder}
              className="w-full rounded-xl border border-slate-300 bg-slate-100/70 py-1.5 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 focus:bg-white transition dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:focus:bg-white/10 dark:focus:border-sky-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white transition"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Switcher */}
            <LanguageSelector />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Navigation back */}
            <Link
              href="/"
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {t.library.backToDashboard}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body (sidebar + content) ─────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Folder Sidebar ─────────────────────────────────────────── */}
        <aside
          className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col transition-all duration-200 dark:border-white/8 dark:bg-[#0e1017] ${
            sidebarOpen ? "w-60" : "w-10"
          }`}
          style={{ minHeight: "calc(100vh - 57px)" }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-white/6">
            {sidebarOpen && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/30 flex items-center gap-1.5">
                <Folder size={11} className="text-amber-500" /> {t.library.folders}
              </span>
            )}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-auto text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white transition"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              <ChevronRight
                size={14}
                className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto py-1.5">
              {/* All Fonts entry */}
              <button
                onClick={() => setActiveFolder(null)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg mx-1 transition ${
                  !activeFolder
                    ? "bg-sky-500/15 text-sky-700 font-semibold dark:text-sky-300"
                    : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/80"
                }`}
                style={{ width: "calc(100% - 8px)" }}
              >
                <Globe size={12} className="flex-shrink-0" />
                <span className="flex-1 text-left">{t.library.allFamilies}</span>
                <span className="text-[9px] text-slate-400 dark:text-white/30 tabular-nums">
                  {families.length}
                </span>
              </button>

              {/* Folder tree */}
              <div className="mt-1">
                {loading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={14} className="animate-spin text-sky-500" />
                  </div>
                ) : (
                  folderTree.map((node) => (
                    <FolderTreeItem
                      key={node.relativePath}
                      node={node}
                      depth={0}
                      activeFolder={activeFolder}
                      onSelect={setActiveFolder}
                      onDownload={downloadFolder}
                      downloadingFolder={downloadingFolder}
                    />
                  ))
                )}
              </div>

              {/* Sidebar footer */}
              {!loading && scannedAt && (
                <div className="px-3 pt-3 pb-2 border-t border-slate-200 dark:border-white/6 mt-2">
                  <p className="text-[9px] text-slate-400 dark:text-white/30 leading-relaxed font-mono">
                    {families.length} {t.library.fontCount}
                    <br />
                    {totalVariants} {t.library.variants}
                  </p>
                  <button
                    onClick={() => fetchFonts(true)}
                    disabled={refreshing}
                    className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-800 dark:text-white/30 dark:hover:text-white transition"
                  >
                    <RefreshCw size={9} className={refreshing ? "animate-spin" : ""} />{" "}
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* Active folder header */}
          {activeFolder && (
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-5 py-3 dark:border-white/6 dark:bg-[#13161e]">
              <div className="flex items-center gap-2">
                <FolderOpen size={15} className="text-amber-500" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {activeFolder}
                </span>
                <span className="text-xs text-slate-500 dark:text-white/40">
                  · {filtered.length} families
                </span>
              </div>
              <div className="flex items-center gap-2">
                {folderTree.length > 0 &&
                  (() => {
                    const node =
                      folderTree.find((n) => n.relativePath === activeFolder) ??
                      folderTree
                        .flatMap(function f(n): FolderNode[] {
                          return [n, ...n.children.flatMap(f)];
                        })
                        .find((n) => n.relativePath === activeFolder);
                    if (!node) return null;
                    return (
                      <button
                        onClick={() =>
                          downloadFolder(node.relativePath, node.name, node.fontCount)
                        }
                        disabled={!!downloadingFolder[node.relativePath]}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-emerald-500/40 dark:hover:text-emerald-400"
                      >
                        {downloadingFolder[node.relativePath] ? (
                          <>
                            <Loader2 size={11} className="animate-spin" /> Downloading…
                          </>
                        ) : (
                          <>
                            <Download size={11} /> {t.library.downloadFolder} (
                            {node.fontCount} fonts)
                          </>
                        )}
                      </button>
                    );
                  })()}
                <button
                  onClick={() => setActiveFolder(null)}
                  className="text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="px-5 py-5 max-w-7xl mx-auto">
            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  showFilters || activeFilterCount > 0
                    ? "border-sky-500 bg-sky-500/12 text-sky-700 dark:text-sky-300"
                    : "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-white"
                }`}
              >
                <Filter size={12} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Language pills */}
              <div className="flex items-center gap-1 border-l border-slate-200 dark:border-white/8 pl-2">
                {[
                  { id: "all", label: t.library.allScripts },
                  { id: "khmer", label: t.library.khmerOnly },
                  { id: "khmer+latin", label: t.library.khmerLatin },
                  { id: "latin", label: t.library.latinOnly },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setLangFilter(s.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                      langFilter === s.id
                        ? "bg-violet-500/15 text-violet-700 border border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5"
                    }`}
                  >
                    {s.id === "all" ? <Globe size={11} /> : <Languages size={11} />}
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 ml-auto">
                <ArrowUpDown size={11} className="text-slate-400 dark:text-white/30" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortValue)}
                  className="rounded-lg border border-slate-300 bg-white py-1.5 pl-2 pr-6 text-xs text-slate-700 shadow-sm outline-none focus:border-sky-500 cursor-pointer dark:border-white/10 dark:bg-[#13161e] dark:text-white/70"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview size slider */}
              <div className="flex items-center gap-2 border-l border-slate-200 dark:border-white/8 pl-2">
                <SlidersHorizontal size={12} className="text-slate-400 dark:text-white/30" />
                <input
                  type="range"
                  min={14}
                  max={80}
                  value={previewSize}
                  onChange={(e) => setPreviewSize(Number(e.target.value))}
                  className="w-20 accent-sky-500 cursor-pointer"
                />
                <span className="text-[10px] tabular-nums text-slate-400 dark:text-white/30 w-7">
                  {previewSize}px
                </span>
              </div>
            </div>

            {/* ── Filter & Custom text panel ───────────────────────────── */}
            {showFilters && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4 space-y-4 shadow-sm dark:border-white/8 dark:bg-[#13161e] dark:shadow-none">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">
                    {t.library.testText}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder={t.showcase.liveTesterPlaceholder}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-500 transition dark:border-white/10 dark:bg-black/30 dark:text-white dark:placeholder:text-white/20"
                    />
                    {customText && (
                      <button
                        onClick={() => setCustomText("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setSampleIdx((i) => i + 1)}
                    className="mt-1.5 text-[10px] text-sky-600 hover:underline dark:text-sky-400 transition"
                  >
                    Cycle sample text ↺
                  </button>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setLangFilter("all");
                      setActiveFolder(null);
                    }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:underline transition"
                  >
                    <X size={11} /> Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Results summary */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500 dark:text-white/40">
                {filtered.length === families.length
                  ? `${filtered.length} ${t.library.allFamilies}`
                  : `${filtered.length} of ${families.length} families`}
                {search && (
                  <span className="ml-1 text-sky-600 dark:text-sky-400">
                    for &ldquo;{search}&rdquo;
                  </span>
                )}
                {activeFolder && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                    in {activeFolder}
                  </span>
                )}
              </p>
              {(search || activeFilterCount > 0) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setLangFilter("all");
                    setActiveFolder(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white transition"
                >
                  {t.common.clear}
                </button>
              )}
            </div>

            {/* Loading & Error */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-28 gap-3">
                <Loader2 size={28} className="animate-spin text-sky-500" />
                <p className="text-sm text-slate-500 dark:text-white/40">{t.common.loading}</p>
              </div>
            )}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <AlertCircle size={28} className="text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                <button
                  onClick={() => fetchFonts()}
                  className="mt-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center dark:border-white/8">
                <Search size={26} className="mb-3 text-slate-300 dark:text-white/20" />
                <p className="text-sm text-slate-500 dark:text-white/40">No fonts match your search.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setLangFilter("all");
                    setActiveFolder(null);
                  }}
                  className="mt-2 text-xs text-sky-600 dark:text-sky-400 hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )}

            {/* ── Font Cards Grid ──────────────────────────────────────── */}
            {!loading && !error && filtered.length > 0 && (
              <div className="flex flex-col gap-3.5">
                {filtered.map((font) => {
                  const isExp = expanded.has(font.id);
                  const hasVar = font.variants.some((v) => v.isVariable);
                  const primary =
                    font.variants.find((v) => !v.italic) ?? font.variants[0];
                  const pid = primary ? faceId(font.id, primary.fileName) : "";

                  return (
                    <div
                      key={font.id}
                      className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-slate-300 dark:border-white/8 dark:bg-[#12141b] dark:shadow-none dark:hover:border-white/15"
                    >
                      {/* Card header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                              {font.family}
                            </h2>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                LANG_COLORS[font.language] ?? LANG_COLORS.other
                              }`}
                            >
                              {font.language === "khmer+latin"
                                ? "Khmer + Latin"
                                : font.language === "khmer"
                                ? "Khmer"
                                : "Latin"}
                            </span>
                            {hasVar && (
                              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                                Variable
                              </span>
                            )}
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                              OFL
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() =>
                                setActiveFolder(
                                  activeFolder === font.folder ? null : font.folder
                                )
                              }
                              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                                activeFolder === font.folder
                                  ? "bg-amber-500/20 text-amber-700 border border-amber-500/40 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-500 hover:text-amber-700 dark:bg-white/5 dark:text-white/40 dark:hover:text-amber-300"
                              }`}
                            >
                              <Folder size={10} />
                              {font.folder}
                            </button>

                            <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                              {primary?.subfamilyName || "Regular"}
                            </span>
                            <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                              w{primary?.weight ?? 400}
                            </span>
                            {primary?.italic && (
                              <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 italic dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                                italic
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => downloadAll(font)}
                            disabled={!!downloading[`all-${font.id}`]}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-emerald-400"
                          >
                            {downloading[`all-${font.id}`] ? (
                              <>
                                <Loader2 size={11} className="animate-spin" /> Saving…
                              </>
                            ) : (
                              <>
                                <Download size={11} /> {t.common.download}
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => toggleExpand(font.id)}
                            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                              isExp
                                ? "border-sky-500 bg-sky-500/12 text-sky-700 dark:text-sky-400"
                                : "border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-sky-400"
                            }`}
                          >
                            {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {isExp ? "Collapse" : t.common.details}
                          </button>
                        </div>
                      </div>

                      {/* Live preview */}
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 space-y-3 dark:border-white/6 dark:bg-black/15">
                        {font.language !== "latin" && (
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-violet-600/70 dark:text-violet-400/60">
                                ភាសាខ្មែរ · Khmer
                              </span>
                              <button
                                onClick={() => copyText(getSample(font, "khmer"), `km-${font.id}`)}
                                className="text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white transition"
                              >
                                {copied[`km-${font.id}`] ? (
                                  <Check size={11} className="text-emerald-500" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                            <p
                              className="text-slate-900 leading-relaxed select-text transition-all dark:text-white/90"
                              style={{
                                fontFamily: `'${pid}', sans-serif`,
                                fontWeight: primary?.weight ?? 400,
                                fontStyle: primary?.italic ? "italic" : "normal",
                                fontSize: previewSize,
                              }}
                            >
                              {getSample(font, "khmer")}
                            </p>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-sky-600/70 dark:text-sky-400/60">
                              English · Latin
                            </span>
                            <button
                              onClick={() => copyText(getSample(font, "en"), `en-${font.id}`)}
                              className="text-slate-400 hover:text-slate-700 dark:text-white/30 dark:hover:text-white transition"
                            >
                              {copied[`en-${font.id}`] ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                          <p
                            className="text-slate-800 leading-relaxed select-text transition-all dark:text-white/80"
                            style={{
                              fontFamily: `'${pid}', sans-serif`,
                              fontWeight: primary?.weight ?? 400,
                              fontStyle: primary?.italic ? "italic" : "normal",
                              fontSize: previewSize,
                            }}
                          >
                            {getSample(font, "en")}
                          </p>
                        </div>
                      </div>

                      {/* Expanded: variants */}
                      {isExp && (
                        <div className="border-t border-slate-100 px-5 py-5 dark:border-white/6">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 mb-4">
                            Variants &amp; CSS Snippets
                          </h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {font.variants.map((variant) => {
                              const vid = faceId(font.id, variant.fileName);
                              const dlKey = `dl-${font.id}-${variant.fileName}`;
                              const cssKey = `css-${font.id}-${variant.fileName}`;
                              const css = buildCssSnippet(font, variant);
                              return (
                                <div
                                  key={variant.fileName}
                                  className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden dark:border-white/8 dark:bg-black/20"
                                >
                                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-white/6">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-semibold text-slate-900 dark:text-white/80">
                                          {variant.subfamilyName}
                                        </span>
                                        {variant.italic && (
                                          <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-600 italic dark:bg-white/8 dark:text-white/40">
                                            italic
                                          </span>
                                        )}
                                        {variant.isVariable && (
                                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] text-sky-600 dark:text-sky-400 font-semibold">
                                            var
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9px] text-slate-500 dark:text-white/30 mt-0.5">
                                        weight {variant.weight} · {formatBytes(variant.size)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        downloadVariant(
                                          variant.relativePath,
                                          variant.fileName,
                                          dlKey
                                        )
                                      }
                                      disabled={!!downloading[dlKey]}
                                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] text-slate-700 shadow-sm hover:border-sky-500 hover:text-sky-600 transition disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white/50 dark:hover:text-sky-400"
                                    >
                                      {downloading[dlKey] ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <Download size={10} />
                                      )}
                                      {variant.ext}
                                    </button>
                                  </div>

                                  <div className="px-4 py-3 border-b border-slate-200 dark:border-white/6">
                                    <p
                                      className="text-slate-800 truncate dark:text-white/80"
                                      style={{
                                        fontFamily: `'${vid}', sans-serif`,
                                        fontWeight: variant.weight,
                                        fontStyle: variant.italic ? "italic" : "normal",
                                        fontSize: Math.max(16, previewSize * 0.6),
                                      }}
                                    >
                                      {customText ||
                                        (font.language !== "latin"
                                          ? KHMER_SAMPLES[0].split(" ").slice(0, 4).join(" ")
                                          : LATIN_SAMPLES[0].split(" ").slice(0, 6).join(" "))}
                                    </p>
                                  </div>

                                  <div className="relative group">
                                    <pre className="overflow-x-auto px-4 py-3 text-[10px] leading-relaxed text-emerald-700 font-mono whitespace-pre dark:text-emerald-300/80 bg-slate-100 dark:bg-black/40">
                                      {css}
                                    </pre>
                                    <button
                                      onClick={() => copyText(css, cssKey)}
                                      className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-600 shadow-sm opacity-0 group-hover:opacity-100 hover:border-sky-500 hover:text-sky-600 transition dark:border-white/10 dark:bg-[#1a1e28] dark:text-white/50 dark:hover:text-sky-400"
                                    >
                                      {copied[cssKey] ? (
                                        <Check size={10} className="text-emerald-500" />
                                      ) : (
                                        <Copy size={10} />
                                      )}
                                      {copied[cssKey] ? t.common.copied : t.common.copy}
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-100/50 dark:border-white/6 dark:bg-black/10">
                                    <span className="text-[9px] text-slate-400 font-mono truncate flex-1 dark:text-white/25">
                                      {variant.relativePath}
                                    </span>
                                    <a
                                      href={fontFileUrl(variant.relativePath)}
                                      download={variant.fileName}
                                      className="shrink-0 ml-3 text-[10px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                                    >
                                      {t.library.downloadFont} ↓
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-14 border-t border-slate-200 pt-6 pb-12 text-center space-y-1 dark:border-white/6">
              <p className="text-xs text-slate-400 dark:text-white/20">
                All fonts served from <code className="text-emerald-600 dark:text-emerald-400/60">fonts/</code> · OFL 1.1
              </p>
              <p className="text-xs text-slate-400 dark:text-white/15">
                K Fonts Creator · {new Date().getFullYear()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
