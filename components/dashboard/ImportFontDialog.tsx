"use client";

import { useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { importFontFile, ImportResult } from "@/lib/fontImport";
import { UploadCloud, Loader2, FileWarning } from "lucide-react";
import { useLanguage } from "@/components/providers/AppProviders";

export default function ImportFontDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setError(null);
    setBusy(true);
    try {
      const projectId = crypto.randomUUID();
      const result = await importFontFile(file, projectId);
      onImported(result);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? `${t.common.error}: ${e.message}`
          : "Could not parse this font file."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t.dialogs.importTitle} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-white/50">
          {t.dialogs.importDrag}
        </p>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-all hover:border-sky-500 hover:bg-sky-50/50 dark:border-white/15 dark:bg-black/20 dark:hover:border-sky-500/50 dark:hover:bg-white/5"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin text-sky-500" size={22} />
              <span className="text-xs text-slate-600 dark:text-white/60">{t.common.loading} ({fileName})</span>
            </>
          ) : (
            <>
              <UploadCloud className="text-slate-400 dark:text-white/40" size={24} />
              <span className="text-xs font-medium text-slate-700 dark:text-white/70">
                {t.dialogs.importDrag}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-white/30 font-mono">.ttf · .otf · .woff</span>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,font/ttf,font/otf,font/woff"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
            <FileWarning size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
