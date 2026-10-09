import { OutputPrefix, buildPartName } from "@/domain/value-objects/output-prefix";
import { SizeLimit } from "@/domain/value-objects/size-limit";
import { planSplit } from "@/domain/services/split-planner";
import {
  CorruptPdfError,
  EncryptedPdfError,
} from "@/domain/errors/pdf-errors";
import type { IPdfGateway, PdfHandle } from "@/application/ports/pdf-gateway.port";
import {
  MAX_FILES,
  MAX_TOTAL_BYTES,
  type ProcessPdfsInput,
  type ProcessPdfsResult,
  type ProgressCallback,
  type SkippedSource,
} from "@/application/dto/process-pdfs.dto";

interface FlatPage {
  handle: PdfHandle;
  pageIndex: number;
  size: number;
}

export async function yieldToEventLoop(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function report(monotonic: { last: number }, cb: ProgressCallback | undefined, p: number) {
  if (!cb) return;
  const v = Math.max(0, Math.min(100, Math.round(p)));
  if (v >= monotonic.last) {
    monotonic.last = v;
    cb(v);
  }
}

export async function processPdfs(
  input: ProcessPdfsInput,
  gateway: IPdfGateway,
  onProgress?: ProgressCallback,
): Promise<ProcessPdfsResult> {
  const limit = new SizeLimit(input.maxSizeBytes);
  const prefix = new OutputPrefix(input.outputPrefix);
  const prog = { last: -1 };

  if (input.sources.length === 0) return { parts: [], skipped: [] };
  if (input.sources.length > MAX_FILES) {
    throw new Error(`Limite de ${MAX_FILES} arquivos excedido`);
  }
  const totalBytes = input.sources.reduce((a, s) => a + s.data.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("Volume total excede 200 MB");
  }

  // 1. Load isolado por arquivo (não aborta a fila)
  const skipped: SkippedSource[] = [];
  const loaded: { id: string; fileName: string; handle: PdfHandle; pageCount: number }[] = [];

  for (let i = 0; i < input.sources.length; i++) {
    const s = input.sources[i];
    try {
      const handle = await gateway.loadDocument(s.data, s.fileName);
      loaded.push({ id: s.id, fileName: s.fileName, handle, pageCount: gateway.getPageCount(handle) });
    } catch (e) {
      if (e instanceof EncryptedPdfError) {
        skipped.push({ id: s.id, fileName: s.fileName, code: "ENCRYPTED_PDF", reason: e.message });
      } else {
        const msg = e instanceof CorruptPdfError ? e.message : `PDF inválido ou corrompido: ${s.fileName}`;
        skipped.push({ id: s.id, fileName: s.fileName, code: "CORRUPT_PDF", reason: msg });
      }
    }
    report(prog, onProgress, ((i + 1) / input.sources.length) * 30);
    await yieldToEventLoop();
  }

  if (loaded.length === 0) {
    report(prog, onProgress, 100);
    return { parts: [], skipped };
  }

  // 2. Achata páginas com estimativa individual (1 save por página, nunca O(n²) do doc inteiro)
  const flat: FlatPage[] = [];
  for (const doc of loaded) {
    for (let p = 0; p < doc.pageCount; p++) {
      flat.push({ handle: doc.handle, pageIndex: p, size: await gateway.getSinglePageSize(doc.handle, p) });
    }
  }

  // 3. Plano puro de corte (domínio, sem I/O)
  const plan = planSplit(flat.map((f) => f.size), limit.bytes);
  const oversized = new Set(plan.oversizedIndices);

  // 4. Materializa cada parte (agrupa cópias por handle de origem)
  const parts: ProcessPdfsResult["parts"] = [];
  for (let pi = 0; pi < plan.parts.length; pi++) {
    const indices = plan.parts[pi];
    const dest = await gateway.createDocument();

    let cursor = 0;
    while (cursor < indices.length) {
      const h = flat[indices[cursor]].handle;
      const batch: number[] = [];
      while (cursor < indices.length && flat[indices[cursor]].handle === h) {
        batch.push(flat[indices[cursor]].pageIndex);
        cursor++;
      }
      await gateway.copyPages(h, batch, dest);
    }

    let data = await gateway.save(dest);
    let pages = [...indices];

    // Verificação + bisseção de segurança: estimativa pode divergir do save real
    let guard = 0;
    while (data.length > limit.bytes && pages.length > 1 && guard++ < 10) {
      const half = Math.ceil(pages.length / 2);
      const firstHalf = pages.slice(0, half);
      pages = firstHalf;
      const retry = await gateway.createDocument();
      let c = 0;
      while (c < pages.length) {
        const h = flat[pages[c]].handle;
        const batch: number[] = [];
        while (c < pages.length && flat[pages[c]].handle === h) {
          batch.push(flat[pages[c]].pageIndex);
          c++;
        }
        await gateway.copyPages(h, batch, retry);
      }
      data = await gateway.save(retry);
      // páginas restantes voltam como nova parte logo após esta
      const rest = indices.slice(pages.length);
      if (rest.length > 0) plan.parts.splice(pi + 1, 0, rest);
      break; // uma bisseção basta; resto é reprocessado como parte seguinte
    }

    parts.push({
      name: buildPartName(prefix, parts.length + 1),
      data,
      sizeBytes: data.length,
      pageCount: pages.length,
      oversized: pages.length === 1 && oversized.has(pages[0]),
    });

    report(prog, onProgress, 30 + ((pi + 1) / plan.parts.length) * 70);
    await yieldToEventLoop();
  }

  report(prog, onProgress, 100);
  return { parts, skipped };
}

export const __testUtils = { yieldToEventLoop };
