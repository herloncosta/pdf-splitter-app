export interface PdfSourceView {
  id: string;
  file: File;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  status: "ready" | "probing" | "error";
  errorMessage?: string;
}

export function makeSourceId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
