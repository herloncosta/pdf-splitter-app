import { PDFDocument } from "pdf-lib";
import type {
  IPdfGateway,
  PdfHandle,
} from "@/application/ports/pdf-gateway.port";
import {
  CorruptPdfError,
  EncryptedPdfError,
} from "@/domain/errors/pdf-errors";

/** Adapter fino: traduz pdf-lib para o Port. Sem lógica de corte aqui (SOLID-S). */
export class PdfLibGatewayAdapter implements IPdfGateway {
  private docs = new Map<PdfHandle, PDFDocument>();
  private seq = 0;

  private mint(doc: PDFDocument): PdfHandle {
    const h = `pdf-${this.seq++}`;
    this.docs.set(h, doc);
    return h;
  }

  private get(handle: PdfHandle): PDFDocument {
    const d = this.docs.get(handle);
    if (!d) throw new Error(`Handle desconhecido: ${handle}`);
    return d;
  }

  async createDocument(): Promise<PdfHandle> {
    return this.mint(await PDFDocument.create());
  }

  async loadDocument(data: Uint8Array, fileName: string): Promise<PdfHandle> {
    try {
      const bytes = data.slice().buffer as ArrayBuffer;
      return this.mint(await PDFDocument.load(bytes, { ignoreEncryption: false }));
    } catch (e) {
      throw this.mapError(e, fileName);
    }
  }

  getPageCount(handle: PdfHandle): number {
    return this.get(handle).getPageCount();
  }

  async copyPages(src: PdfHandle, srcIndices: number[], dest: PdfHandle): Promise<void> {
    const s = this.get(src);
    const d = this.get(dest);
    const pages = await d.copyPages(s, srcIndices);
    pages.forEach((p) => d.addPage(p));
  }

  async save(handle: PdfHandle): Promise<Uint8Array> {
    return await this.get(handle).save();
  }

  async probePageCount(data: Uint8Array, fileName: string): Promise<number> {
    try {
      const bytes = data.slice().buffer as ArrayBuffer;
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
      return doc.getPageCount();
    } catch (e) {
      throw this.mapError(e, fileName);
    }
  }

  private mapError(e: unknown, fileName: string): Error {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg)) return new EncryptedPdfError(fileName);
    return new CorruptPdfError(fileName);
  }
}
