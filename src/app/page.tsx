"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_FILES, MAX_TOTAL_BYTES } from "@/application/dto/process-pdfs.dto";
import { probePageCount } from "@/application/use-cases/probe-page-count";
import { PdfLibGatewayAdapter } from "@/infrastructure/pdf/pdf-lib-gateway.adapter";
import { JsZipGatewayAdapter } from "@/infrastructure/zip/jszip-gateway.adapter";
import { usePdfProcessor } from "@/interface/hooks/usePdfProcessor";
import { Dropzone } from "@/interface/components/Dropzone";
import { FileList } from "@/interface/components/FileList";
import { SettingsPanel } from "@/interface/components/SettingsPanel";
import { ProcessProgressBar } from "@/interface/components/ProcessProgressBar";
import { DownloadSection } from "@/interface/components/DownloadSection";
import { makeSourceId, type PdfSourceView } from "@/interface/components/pdf-source";
import { ERROR_MESSAGES } from "@/shared/utils/error-messages";

export default function HomePage() {
  const [sources, setSources] = useState<PdfSourceView[]>([]);
  const [prefix, setPrefix] = useState("Documento_Processado");
  const [maxSizeBytes, setMaxSizeBytes] = useState(2_800_000);
  const [notice, setNotice] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const processor = usePdfProcessor();
  const pdfGateway = useMemo(() => new PdfLibGatewayAdapter(), []);

  useEffect(() => {
    return () => {
      if (zipUrl) URL.revokeObjectURL(zipUrl);
    };
  }, [zipUrl]);

  const addFiles = useCallback(
    async (files: File[]) => {
      setNotice(null);
      const fresh: PdfSourceView[] = files.map((f) => ({
        id: makeSourceId(),
        file: f,
        fileName: f.name,
        sizeBytes: f.size,
        pageCount: null,
        status: "probing" as const,
      }));

      const merged = [...sources, ...fresh];
      if (merged.length > MAX_FILES) {
        setNotice(ERROR_MESSAGES.TOO_MANY_FILES);
        return;
      }
      if (merged.reduce((a, s) => a + s.sizeBytes, 0) > MAX_TOTAL_BYTES) {
        setNotice(ERROR_MESSAGES.TOTAL_TOO_LARGE);
        return;
      }
      setSources(merged);

      for (const item of fresh) {
        try {
          const buf = new Uint8Array(await item.file.arrayBuffer());
          const n = await probePageCount(buf, item.fileName, pdfGateway);
          setSources((prev) => prev.map((p) => (p.id === item.id ? { ...p, pageCount: n, status: "ready" as const } : p)));
        } catch {
          setSources((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, status: "error" as const, errorMessage: ERROR_MESSAGES.CORRUPT_PDF } : p,
            ),
          );
        }
      }
    },
    [sources, pdfGateway],
  );

  const readySources = sources.filter((s) => s.status === "ready");

  async function handleProcess() {
    setNotice(null);
    const inputs = await Promise.all(
      readySources.map(async (s) => ({ id: s.id, fileName: s.fileName, data: new Uint8Array(await s.file.arrayBuffer()) })),
    );
    try {
      await processor.process(inputs, maxSizeBytes, prefix);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleZip() {
    if (processor.results.length === 0 || zipping) return;
    setZipping(true);
    try {
      if (zipUrl) URL.revokeObjectURL(zipUrl);
      const entries = await Promise.all(
        processor.results.map(async (p) => ({ name: p.name, data: new Uint8Array(await p.blob.arrayBuffer()) })),
      );
      const bytes = await new JsZipGatewayAdapter().createZip(entries);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
      setZipUrl(URL.createObjectURL(blob));
    } finally {
      setZipping(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">PDF Splitter</h1>
        <p className="text-sm text-zinc-600">Unifique e divida PDFs em partes de até 3 MB — 100% no navegador.</p>
      </header>

      <Dropzone onFiles={addFiles} />
      {notice && <p role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{notice}</p>}

      <FileList
        sources={sources}
        onRemove={(id) => setSources((prev) => prev.filter((s) => s.id !== id))}
        onReorder={(ids) => setSources((prev) => ids.flatMap((id) => prev.filter((s) => s.id === id)))}
      />

      <SettingsPanel outputPrefix={prefix} maxSizeBytes={maxSizeBytes} onPrefixChange={setPrefix} onLimitChange={setMaxSizeBytes} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleProcess}
          disabled={readySources.length === 0 || processor.isProcessing}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {processor.isProcessing ? "Processando…" : `Unificar e dividir (${readySources.length})`}
        </button>
        {sources.length > 0 && (
          <button type="button" onClick={() => { setSources([]); processor.reset(); }} className="text-sm underline">
            Limpar tudo
          </button>
        )}
      </div>

      {processor.isProcessing && <ProcessProgressBar value={processor.progress} />}
      {processor.error && <p role="alert" className="text-sm text-red-600">{processor.error}</p>}

      {processor.skipped.length > 0 && (
        <ul className="text-sm text-amber-700">
          {processor.skipped.map((s) => (
            <li key={s.id}>Ignorado {s.fileName}: {s.reason}</li>
          ))}
        </ul>
      )}

      <DownloadSection parts={processor.results} zipping={zipping} zipUrl={zipUrl} onDownloadZip={handleZip} />

      <footer className="mt-auto border-t pt-3 text-xs text-zinc-500">
        100% local — nenhum documento sai do seu navegador.
      </footer>
    </main>
  );
}
