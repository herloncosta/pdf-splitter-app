"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProcessedPartOutput,
  SkippedSource,
} from "@/application/dto/process-pdfs.dto";

export interface ProcessorSource {
  id: string;
  fileName: string;
  data: Uint8Array;
}

export interface ProcessedPartView extends Omit<ProcessedPartOutput, "data"> {
  blob: Blob;
  url: string;
}

/** Injeção para teste (TDD na seam do hook, sem Worker real no jsdom). */
export interface ProcessorDeps {
  runProcess?: (args: {
    sources: ProcessorSource[];
    maxSizeBytes: number;
    outputPrefix: string;
    onProgress: (p: number) => void;
  }) => Promise<{ parts: ProcessedPartOutput[]; skipped: SkippedSource[] }>;
}

async function defaultRun(args: ProcessorDeps["runProcess"] extends never ? never : {
  sources: ProcessorSource[];
  maxSizeBytes: number;
  outputPrefix: string;
  onProgress: (p: number) => void;
}): Promise<{ parts: ProcessedPartOutput[]; skipped: SkippedSource[] }> {
  const { processPdfs } = await import("@/application/use-cases/process-pdfs.use-case");
  const { PdfLibGatewayAdapter } = await import("@/infrastructure/pdf/pdf-lib-gateway.adapter");
  return processPdfs(
    { sources: args.sources, maxSizeBytes: args.maxSizeBytes, outputPrefix: args.outputPrefix },
    new PdfLibGatewayAdapter(),
    args.onProgress,
  );
}

export function usePdfProcessor(deps: ProcessorDeps = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ProcessedPartView[]>([]);
  const [skipped, setSkipped] = useState<SkippedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  const revokeAll = useCallback(() => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  }, []);

  useEffect(() => revokeAll, [revokeAll]);

  const reset = useCallback(() => {
    revokeAll();
    setResults([]);
    setSkipped([]);
    setError(null);
    setProgress(0);
  }, [revokeAll]);

  const process = useCallback(
    async (sources: ProcessorSource[], maxSizeBytes: number, outputPrefix: string) => {
      setIsProcessing(true);
      setError(null);
      setProgress(0);
      revokeAll();
      try {
        const run = deps.runProcess ?? defaultRun;
        const out = await run({ sources, maxSizeBytes, outputPrefix, onProgress: setProgress });
        const views = out.parts.map((p) => {
          const blob = new Blob([p.data as unknown as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          return { name: p.name, sizeBytes: p.sizeBytes, pageCount: p.pageCount, oversized: p.oversized, blob, url };
        });
        setResults(views);
        setSkipped(out.skipped);
        setProgress(100);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsProcessing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revokeAll],
  );

  return { isProcessing, progress, results, skipped, error, process, reset };
}
