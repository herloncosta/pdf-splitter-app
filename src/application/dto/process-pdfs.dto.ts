export interface OrderedPdfSourceInput {
  id: string;
  fileName: string;
  data: Uint8Array;
}

export interface ProcessPdfsInput {
  sources: OrderedPdfSourceInput[];
  maxSizeBytes: number;
  outputPrefix: string;
}

export interface SkippedSource {
  id: string;
  fileName: string;
  code: "ENCRYPTED_PDF" | "CORRUPT_PDF";
  reason: string;
}

export interface ProcessedPartOutput {
  name: string;
  data: Uint8Array;
  sizeBytes: number;
  pageCount: number;
  oversized: boolean;
}

export interface ProcessPdfsResult {
  parts: ProcessedPartOutput[];
  skipped: SkippedSource[];
}

export type ProgressCallback = (percentage: number) => void;

export const MAX_FILES = 20;
export const MAX_TOTAL_BYTES = 200_000_000;
