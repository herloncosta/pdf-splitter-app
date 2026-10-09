"use client";

import { formatBytes } from "@/shared/utils/formatters";
import type { ProcessedPartView } from "@/interface/hooks/usePdfProcessor";

interface DownloadSectionProps {
  parts: ProcessedPartView[];
  zipping: boolean;
  zipUrl: string | null;
  onDownloadZip: () => void;
}

export function DownloadSection({ parts, zipping, zipUrl, onDownloadZip }: DownloadSectionProps) {
  if (parts.length === 0) return null;
  const oversized = parts.filter((p) => p.oversized);

  return (
    <section aria-label="Downloads" className="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <h2 className="text-sm font-semibold">Partes geradas ({parts.length})</h2>
      {oversized.length > 0 && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {oversized.length} parte(s) excede(m) o limite sozinha(s): {oversized.map((p) => p.name).join(", ")}. Considere digitalizar em menor resolução.
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {parts.map((p) => (
          <li key={p.url} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {p.name} <span className="text-zinc-500">• {formatBytes(p.sizeBytes)} • {p.pageCount} pág.</span>
            </span>
            <a href={p.url} download={p.name} className="rounded border px-2 py-1 text-xs">
              Baixar
            </a>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onDownloadZip} disabled={zipping} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50">
          {zipping ? "Gerando ZIP…" : "Baixar tudo (.zip)"}
        </button>
        {zipUrl && (
          <a href={zipUrl} download="pdf-splitter.zip" className="text-sm underline">
            Salvar ZIP
          </a>
        )}
      </div>
    </section>
  );
}
