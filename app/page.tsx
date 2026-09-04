"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, UploadCloud, Type, BookOpen, Sparkles,
  ArrowRight, Layers, Download, Code2,
  Compass, PenTool, Cpu, Sliders,
  Search
} from "lucide-react";
import { FontProject } from "@/lib/types";
import { db } from "@/lib/db";
import ProjectCard from "@/components/dashboard/ProjectCard";
import NewProjectDialog from "@/components/dashboard/NewProjectDialog";
import ImportFontDialog from "@/components/dashboard/ImportFontDialog";
import { ImportResult } from "@/lib/fontImport";
import { useLanguage } from "@/components/providers/AppProviders";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";

const FEATURED_SHOWCASE = [
  {
    name: "Kantumruy Pro Bold",
    category: "Khmer + Latin · Sans",
    sampleKm: "អក្សរខ្មែរ ស្រស់ស្អាត ជាភាសារបស់ជនជាតិខ្មែរ",
    sampleEn: "The quick brown fox jumps over the lazy dog.",
    fontFamily: "KantumruyPro-Bold",
    url: "/api/font-file/KhmerFonts/Kantumruy_Pro/static/KantumruyPro-Bold.ttf",
    folder: "KhmerFonts/Kantumruy_Pro",
    weight: 700,
  },
  {
    name: "Battambang Bold",
    category: "Khmer Unicode · Display",
    sampleKm: "ភាសាខ្មែរ រុងរឿង និងសម្បូរបែបក្នុងប្រវត្តិសាស្ត្រ",
    sampleEn: "Sphinx of black quartz, judge my vow 12345.",
    fontFamily: "Battambang-Bold",
    url: "/api/font-file/KhmerFonts/All%20Khmer%20Unicode%20Fonts/Battambang-Bold.ttf",
    folder: "KhmerFonts/All Khmer Unicode Fonts",
    weight: 700,
  },
  {
    name: "Doto ExtraBold",
    category: "Modern Latin · Dot Matrix",
    sampleKm: "បច្ចេកវិទ្យាឌីជីថលជំនាន់ថ្មី ឆ្នាំ ២០២៦",
    sampleEn: "MODERN VARIABLE DOT MATRIX TYPOGRAPHY",
    fontFamily: "Doto-ExtraBold",
    url: "/api/font-file/EnglishFonts/Doto/static/Doto-ExtraBold.ttf",
    folder: "EnglishFonts/Doto",
    weight: 800,
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [projects, setProjects] = useState<FontProject[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchProject, setSearchProject] = useState("");
  const [sampleText, setSampleText] = useState("");

  const TEMPLATES = [
    {
      id: "khmer-unicode",
      title: t.templates.khmerUnicodeTitle,
      desc: t.templates.khmerUnicodeDesc,
      mode: "outline" as const,
      upm: 1000,
      asc: 800,
      desc_val: -200,
      badge: t.templates.popularBadge,
    },
    {
      id: "latin-clean",
      title: t.templates.latinCleanTitle,
      desc: t.templates.latinCleanDesc,
      mode: "outline" as const,
      upm: 1000,
      asc: 750,
      desc_val: -250,
      badge: t.templates.cleanBadge,
    },
    {
      id: "single-line-cnc",
      title: t.templates.singleLineTitle,
      desc: t.templates.singleLineDesc,
      mode: "single-line" as const,
      upm: 1000,
      asc: 800,
      desc_val: -200,
      badge: t.templates.cncBadge,
    },
  ];

  useEffect(() => {
    db.listProjects().then(setProjects);
  }, []);

  // Inject showcase font faces
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = FEATURED_SHOWCASE.map(
      (f) => `
      @font-face {
        font-family: '${f.fontFamily}';
        src: url('${f.url}');
        font-weight: 100 1000;
        font-display: swap;
      }`
    ).join("\n");
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  async function handleCreate(project: FontProject) {
    await db.putProject(project);
    router.push(`/project/${project.id}`);
  }

  async function handleCreateFromTemplate(tmpl: typeof TEMPLATES[number]) {
    const p: FontProject = {
      id: crypto.randomUUID(),
      name: `Untitled ${tmpl.title}`,
      author: "",
      version: "1.0.0",
      unitsPerEm: tmpl.upm,
      ascender: tmpl.asc,
      descender: tmpl.desc_val,
      capHeight: Math.round(tmpl.asc * 0.88),
      xHeight: Math.round(tmpl.asc * 0.62),
      fontMode: tmpl.mode,
      strokeWidth: 20,
      dotSpacing: 50,
      dotRadius: 15,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await handleCreate(p);
  }

  async function handleImported(result: ImportResult) {
    await db.putProject(result.project);
    if (result.glyphs.length) await db.putGlyphs(result.glyphs);
    router.push(`/project/${result.project.id}`);
  }

  async function handleDelete(id: string) {
    await db.deleteProject(id);
    setProjects((prev) => prev?.filter((p) => p.id !== id) ?? null);
  }

  const filteredProjects = projects?.filter((p) =>
    p.name.toLowerCase().includes(searchProject.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 flex flex-col selection:bg-sky-500/30 dark:bg-[#0b0d12] dark:text-white">
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-white/8 dark:bg-[#0d0f15]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/10 to-violet-500/10 border border-sky-500/30 text-sky-600 shadow-lg shadow-sky-500/5 dark:from-sky-500/20 dark:to-violet-500/20 dark:text-sky-400 dark:shadow-sky-500/10">
              <Type size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  {t.nav.appTitle}
                </span>
                <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-white/40">{t.nav.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Theme Toggle (Dark / Light) */}
            <ThemeToggle />

            {/* Link to Font Library */}
            <Link
              href="/fonts"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100/70 px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-sky-500/40 hover:text-sky-600 hover:bg-sky-50 transition dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:border-sky-500/40 dark:hover:text-sky-300 dark:hover:bg-sky-500/10"
            >
              <BookOpen size={14} className="text-sky-500 dark:text-sky-400" />
              <span>{t.nav.library}</span>
              <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[9px] font-bold text-sky-700 dark:text-sky-300">
                315
              </span>
            </Link>

            {/* Import Font */}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/70 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <UploadCloud size={14} />
              <span>{t.nav.importFont}</span>
            </button>

            {/* New Project */}
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-400 hover:to-blue-500 transition"
            >
              <Plus size={14} />
              <span>{t.nav.newProject}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-100 via-slate-50 to-white px-6 py-14 dark:border-white/8 dark:bg-gradient-to-b dark:from-[#111420] dark:via-[#0d0f17] dark:to-[#0b0d12]">
        {/* Background glow accents */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-10 right-10 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 mb-5 text-xs text-sky-700 dark:text-sky-300 backdrop-blur-sm">
            <Sparkles size={12} className="text-sky-500 dark:text-sky-400 animate-pulse" />
            <span>{t.hero.badge}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4 leading-tight">
            {t.hero.titlePrefix}{" "}
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 dark:from-sky-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              {t.hero.titleHighlight}
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 dark:text-white/50 leading-relaxed mb-8">
            {t.hero.description}
          </p>

          {/* Quick Metrics Bar */}
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center shadow-sm backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
              <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400">315+</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{t.hero.metricFonts}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center shadow-sm backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
              <p className="text-xl font-extrabold text-violet-600 dark:text-violet-400">100%</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{t.hero.metricKhmer}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center shadow-sm backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">TTF &amp; OTF</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{t.hero.metricExport}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-center shadow-sm backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.03] dark:shadow-none">
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">Local-First</p>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{t.hero.metricStorage}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content Container ─────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-12 flex-1 w-full">
        
        {/* ── Quick Starter Templates ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass size={16} className="text-sky-500 dark:text-sky-400" />
                <span>{t.templates.title}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{t.templates.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                onClick={() => handleCreateFromTemplate(tmpl)}
                className="group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-500/50 hover:bg-sky-50/30 hover:shadow-md transition-all dark:border-white/8 dark:bg-[#12141c] dark:shadow-none dark:hover:border-sky-500/50 dark:hover:bg-[#141824]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                    {tmpl.badge}
                  </span>
                  <ArrowRight size={14} className="text-slate-400 group-hover:text-sky-500 group-hover:translate-x-1 transition-all dark:text-white/20 dark:group-hover:text-sky-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition dark:text-white dark:group-hover:text-sky-300">{tmpl.title}</h3>
                <p className="text-xs text-slate-600 dark:text-white/45 mt-1.5 leading-relaxed">{tmpl.desc}</p>
                <div className="mt-4 flex items-center gap-3 border-t border-slate-100 dark:border-white/6 pt-3 text-[10px] text-slate-400 dark:text-white/30 font-mono">
                  <span>UPM: {tmpl.upm}</span>
                  <span>Asc: +{tmpl.asc}</span>
                  <span>Desc: {tmpl.desc_val}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── User Projects Section ───────────────────────────────────── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={16} className="text-violet-500 dark:text-violet-400" />
                <span>{t.projects.title}</span>
                {projects && projects.length > 0 && (
                  <span className="rounded-full bg-slate-200 dark:bg-white/10 px-2 py-0.5 text-xs text-slate-700 dark:text-white/60 font-mono">
                    {projects.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{t.projects.subtitle}</p>
            </div>

            {projects && projects.length > 0 && (
              <div className="relative w-64">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
                <input
                  type="text"
                  placeholder={t.projects.searchPlaceholder}
                  value={searchProject}
                  onChange={(e) => setSearchProject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/25 dark:focus:border-sky-500/50"
                />
              </div>
            )}
          </div>

          {projects === null ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-white/8 dark:bg-[#12141c] py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.01] dark:shadow-none">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Type size={26} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t.projects.noProjectsTitle}</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-white/40 leading-relaxed">
                {t.projects.noProjectsDesc}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowNew(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-500 transition shadow-sm"
                >
                  <Plus size={13} />
                  {t.nav.newProject}
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <UploadCloud size={13} />
                  {t.nav.importFont}
                </button>
              </div>
            </div>
          ) : filteredProjects && filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/8 dark:bg-[#12141c] py-12 text-center text-xs text-slate-500 dark:text-white/40">
              {t.projects.noMatch} &ldquo;{searchProject}&rdquo;
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {filteredProjects?.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>

        {/* ── Featured Font Showcase from 315+ Library ────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-slate-100/70 p-6 dark:border-white/8 dark:bg-[#11131a]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                  {t.showcase.liveBadge}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{t.showcase.title}</h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1">
                {t.showcase.subtitle}
              </p>
            </div>

            <Link
              href="/fonts"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 transition"
            >
              <BookOpen size={14} />
              <span>{t.showcase.browseAll}</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURED_SHOWCASE.map((f) => (
              <div
                key={f.name}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all dark:border-white/8 dark:bg-black/25 dark:shadow-none dark:hover:border-white/15"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{f.name}</span>
                    <span className="rounded bg-slate-100 dark:bg-white/6 px-1.5 py-0.5 text-[9px] text-slate-500 dark:text-white/35 font-mono">
                      w{f.weight}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-white/30 mb-3">{f.category}</p>

                  <div className="space-y-2 border-t border-slate-100 dark:border-white/6 pt-3">
                    <p
                      className="text-slate-900 dark:text-white text-base leading-relaxed select-text"
                      style={{ fontFamily: `'${f.fontFamily}', sans-serif`, fontWeight: f.weight }}
                    >
                      {sampleText || f.sampleKm}
                    </p>
                    <p
                      className="text-slate-600 dark:text-white/70 text-xs leading-relaxed select-text"
                      style={{ fontFamily: `'${f.fontFamily}', sans-serif`, fontWeight: f.weight }}
                    >
                      {sampleText || f.sampleEn}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/6 flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 dark:text-white/25 font-mono truncate max-w-[140px]">
                    {f.folder}
                  </span>
                  <a
                    href={f.url}
                    download
                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline transition"
                  >
                    <Download size={11} />
                    {t.common.download}
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Live Tester Input */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3 shadow-sm dark:border-white/6 dark:bg-white/[0.02] dark:shadow-none">
            <span className="text-xs font-medium text-slate-500 dark:text-white/40 shrink-0">{t.showcase.liveTesterLabel}</span>
            <input
              type="text"
              placeholder={t.showcase.liveTesterPlaceholder}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none"
            />
            {sampleText && (
              <button
                onClick={() => setSampleText("")}
                className="text-[10px] text-slate-400 hover:text-slate-800 dark:text-white/30 dark:hover:text-white transition"
              >
                {t.common.clear}
              </button>
            )}
          </div>
        </section>

        {/* ── Studio Capabilities Grid ────────────────────────────────── */}
        <section>
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.studio.title}</h2>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-1">
              {t.studio.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#12141c] dark:shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 mb-3">
                <PenTool size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.studio.vectorTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                {t.studio.vectorDesc}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#12141c] dark:shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 mb-3">
                <Cpu size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.studio.subscriptTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                {t.studio.subscriptDesc}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#12141c] dark:shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-3">
                <Code2 size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.studio.compileTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                {t.studio.compileDesc}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#12141c] dark:shadow-none">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-3">
                <Sliders size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.studio.singleLineTitle}</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                {t.studio.singleLineDesc}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-slate-100 px-6 py-8 mt-12 text-center space-y-2 dark:border-white/8 dark:bg-[#090b0f]">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-white/30">
          <span className="font-semibold text-slate-700 dark:text-white/60">{t.nav.appTitle}</span>
          <span>·</span>
          <span>{t.footer.tagline}</span>
          <span>·</span>
          <Link href="/fonts" className="text-sky-600 hover:underline dark:text-sky-400">
            {t.nav.library} (315)
          </Link>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-white/20">
          {t.footer.storageNotice} · {new Date().getFullYear()}
        </p>
      </footer>

      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreate={handleCreate} />}
      {showImport && (
        <ImportFontDialog onClose={() => setShowImport(false)} onImported={handleImported} />
      )}
    </main>
  );
}
