import { OutputPrefix, buildPartName } from "@/domain/value-objects/output-prefix";
import { SizeLimit } from "@/domain/value-objects/size-limit";
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
}

export async function yieldToEventLoop(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function report(monotonic: { last: number }, cb: ProgressCallback | undefined, p: number) {
  if (!cb) return;
  const v = Math.max(0, Math.min(100, Math.round(p)));
  if (v > monotonic.last) {
    monotonic.last = v;
    cb(v);
  }
}

/**
 * Preenchimento guloso com medição real sobre builds íntegros (maximiza o limite).
 *
 * Duas armadilhas do pdf-lib que este algoritmo evita (ambas medidas):
 * 1. Estimar somando páginas salvas isoladas conta recursos compartilhados
 *    (fontes/imagens) 1x por página → corta cedo demais (partes <1MB).
 * 2. `copyPages` página-a-página em chamadas SEPARADAS duplica o recurso
 *    compartilhado no destino (medido: 10 págs c/ 1 imagem = 45KB real vs
 *    436KB copiando separado, ~10x) → mediria um documento inchado.
 *
 * Por isso cada tentativa reconstrói [cursor, end) do zero com cópias em
 * LOTE (runs consecutivas por origem) e a decisão usa o `save()` DESSE
 * build íntegro. Cada parte não-final é maximal: a próxima página de fato
 * excederia o limite.
 */
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

  // 2. Lista plana de páginas na ordem das fontes (sem nenhuma estimativa)
  const flat: FlatPage[] = [];
  for (const doc of loaded) {
    for (let p = 0; p < doc.pageCount; p++) flat.push({ handle: doc.handle, pageIndex: p });
  }

  // 3. Fill guloso: expande a fronteira, rebuild em lote, mede, decide
  const parts: ProcessPdfsResult["parts"] = [];
  const totalPages = flat.length;
  let cursor = 0;

  const pushPart = (data: Uint8Array, pageCount: number, oversized: boolean) =>
    parts.push({
      name: buildPartName(prefix, parts.length + 1),
      data,
      sizeBytes: data.length,
      pageCount,
      oversized,
    });

  /** Reconstrói [start, end) com UMA chamada copyPages por run consecutiva. */
  async function buildRange(start: number, end: number): Promise<PdfHandle> {
    const dest = await gateway.createDocument();
    let i = start;
    while (i < end) {
      const h = flat[i].handle;
      const batch: number[] = [];
      while (i < end && flat[i].handle === h) {
        batch.push(flat[i].pageIndex);
        i++;
      }
      await gateway.copyPages(h, batch, dest);
    }
    return dest;
  }

  while (cursor < totalPages) {
    let end = cursor;
    let lastGoodBytes: Uint8Array | null = null;
    let lastGoodEnd = cursor;
    let trialBytes: Uint8Array | null = null;

    while (end < totalPages) {
      end += 1;
      trialBytes = await gateway.save(await buildRange(cursor, end));
      if (trialBytes.length <= limit.bytes) {
        lastGoodBytes = trialBytes;
        lastGoodEnd = end;
      } else {
        break;
      }
      report(prog, onProgress, 30 + (end / totalPages) * 70);
      await yieldToEventLoop();
    }

    if (lastGoodEnd === cursor) {
      // Nem a primeira página coube: trialBytes é o build [cursor, cursor+1)
      // que estourou sozinho → entrega sinalizada, sem loop.
      pushPart(trialBytes!, 1, true);
      cursor += 1;
    } else {
      pushPart(lastGoodBytes!, lastGoodEnd - cursor, false);
      cursor = lastGoodEnd;
    }
  }

  report(prog, onProgress, 100);
  return { parts, skipped };
}

export const __testUtils = { yieldToEventLoop };
