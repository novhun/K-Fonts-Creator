"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useProjectStore } from "@/lib/projectStore";
import TopBar from "./TopBar";
import GlyphGrid from "./GlyphGrid";
import GlyphEditorCanvas from "./GlyphEditorCanvas";
import MappingPanel from "./MappingPanel";
import PreviewPanel from "./PreviewPanel";

export default function EditorShell({ projectId }: { projectId: string }) {
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const loadProject = useProjectStore((s) => s.loadProject);

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500 dark:text-white/40">
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-slate-600 dark:text-white/50">
        <p>Project not found.</p>
        <Link href="/" className="text-sky-600 dark:text-sky-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-[#0b0d12]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <GlyphGrid />
        <GlyphEditorCanvas />
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white dark:border-white/10 dark:bg-[#101217]">
          <MappingPanel />
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
