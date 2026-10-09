import { processPdfs } from "@/application/use-cases/process-pdfs.use-case";
import { PdfLibGatewayAdapter } from "@/infrastructure/pdf/pdf-lib-gateway.adapter";

interface IncomingSource {
  id: string;
  fileName: string;
  data: ArrayBuffer;
}

interface Incoming {
  type: "process";
  sources: IncomingSource[];
  maxSizeBytes: number;
  outputPrefix: string;
}

self.onmessage = async (ev: MessageEvent<Incoming>) => {
  const msg = ev.data;
  if (msg.type !== "process") return;
  try {
    const gateway = new PdfLibGatewayAdapter();
    const result = await processPdfs(
      {
        sources: msg.sources.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          data: new Uint8Array(s.data),
        })),
        maxSizeBytes: msg.maxSizeBytes,
        outputPrefix: msg.outputPrefix,
      },
      gateway,
      (p) => self.postMessage({ type: "progress", value: p }),
    );
    const parts = result.parts.map((p) => ({
      name: p.name,
      sizeBytes: p.sizeBytes,
      pageCount: p.pageCount,
      oversized: p.oversized,
      data: p.data.buffer as ArrayBuffer,
    }));
    const transfer = parts.map((p) => p.data);
    (self.postMessage as (m: unknown, t: Transferable[]) => void)(
      { type: "done", parts, skipped: result.skipped },
      transfer,
    );
  } catch (e) {
    self.postMessage({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
