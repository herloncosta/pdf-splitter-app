import { describe, expect, it, vi } from "vitest";
import type {
  IPdfGateway,
  PdfHandle,
} from "@/application/ports/pdf-gateway.port";
import {
  CorruptPdfError,
  EncryptedPdfError,
} from "@/domain/errors/pdf-errors";
import {
  processPdfs,
  __testUtils,
} from "@/application/use-cases/process-pdfs.use-case";

const MB = 1_000_000;
const DOC_OVERHEAD = 100;

/** Fake in-memory: cada página tem tamanho pré-registrado por fileName. */
class FakePdfGateway implements IPdfGateway {
  private docs = new Map<PdfHandle, number[]>();
  private names = new Map<PdfHandle, string>();
  private files = new Map<string, number[]>();
  private failures = new Map<string, "encrypted" | "corrupt">();
  private seq = 0;
  copyCalls: { fileName: string; indices: number[] }[] = [];

  registerFile(fileName: string, pageSizes: number[]) {
    this.files.set(fileName, [...pageSizes]);
  }

  failWith(fileName: string, kind: "encrypted" | "corrupt") {
    this.failures.set(fileName, kind);
  }

  async createDocument(): Promise<PdfHandle> {
    const h = `doc-${this.seq++}`;
    this.docs.set(h, []);
    this.names.set(h, "");
    return h;
  }

  async loadDocument(data: Uint8Array, fileName: string): Promise<PdfHandle> {
    const f = this.failures.get(fileName);
    if (f === "encrypted") throw new EncryptedPdfError(fileName);
    if (f === "corrupt") throw new CorruptPdfError(fileName);
    const sizes = this.files.get(fileName);
    if (!sizes) throw new CorruptPdfError(fileName);
    const h = `doc-${this.seq++}`;
    this.docs.set(h, [...sizes]);
    this.names.set(h, fileName);
    return h;
  }

  getPageCount(handle: PdfHandle): number {
    return this.docs.get(handle)!.length;
  }

  async getSinglePageSize(handle: PdfHandle, pageIndex: number): Promise<number> {
    return this.docs.get(handle)![pageIndex] + DOC_OVERHEAD;
  }

  async copyPages(src: PdfHandle, srcIndices: number[], dest: PdfHandle): Promise<void> {
    const s = this.docs.get(src)!;
    const d = this.docs.get(dest)!;
    for (const i of srcIndices) d.push(s[i]);
    this.copyCalls.push({ fileName: this.names.get(src)!, indices: [...srcIndices] });
  }

  async save(handle: PdfHandle): Promise<Uint8Array> {
    const pages = this.docs.get(handle)!;
    const sum = pages.reduce((a, b) => a + b, 0);
    return new Uint8Array(sum + DOC_OVERHEAD);
  }

  async probePageCount(data: Uint8Array, fileName: string): Promise<number> {
    const s = this.files.get(fileName);
    if (!s) throw new CorruptPdfError(fileName);
    return s.length;
  }
}

const bytes = (n: number) => new Uint8Array(n);

describe("ProcessPdfsUseCase (T21)", () => {
  it("preserva a ordem das fontes ao unificar", async () => {
    const gw = new FakePdfGateway();
    gw.registerFile("A.pdf", [100, 200]);
    gw.registerFile("B.pdf", [300]);

    const r = await processPdfs(
      {
        sources: [
          { id: "a", fileName: "A.pdf", data: bytes(10) },
          { id: "b", fileName: "B.pdf", data: bytes(10) },
        ],
        maxSizeBytes: 10 * MB,
        outputPrefix: "Doc",
      },
      gw,
    );

    expect(r.parts).toHaveLength(1);
    expect(r.parts[0].pageCount).toBe(3);
    expect(r.parts[0].name).toBe("Doc_Parte_01.pdf");
    // ordem materializada: A[0,1] depois B[0]
    expect(gw.copyCalls).toEqual([
      { fileName: "A.pdf", indices: [0, 1] },
      { fileName: "B.pdf", indices: [0] },
    ]);
  });

  it("corta respeitando o limite", async () => {
    const gw = new FakePdfGateway();
    gw.registerFile("A.pdf", [1 * MB, 1 * MB, 1 * MB]);

    const r = await processPdfs(
      {
        sources: [{ id: "a", fileName: "A.pdf", data: bytes(10) }],
        maxSizeBytes: 2_800_000,
        outputPrefix: "Doc",
      },
      gw,
    );

    expect(r.parts).toHaveLength(2);
    expect(r.parts[0].pageCount).toBe(2);
    expect(r.parts[1].pageCount).toBe(1);
    for (const p of r.parts) expect(p.sizeBytes).toBeLessThanOrEqual(2_800_000);
    expect(r.parts[0].oversized).toBe(false);
  });

  it("sinaliza página única que estoura o limite sem loop", async () => {
    const gw = new FakePdfGateway();
    gw.registerFile("Big.pdf", [5 * MB]);

    const r = await processPdfs(
      {
        sources: [{ id: "b", fileName: "Big.pdf", data: bytes(10) }],
        maxSizeBytes: 2_800_000,
        outputPrefix: "Doc",
      },
      gw,
    );

    expect(r.parts).toHaveLength(1);
    expect(r.parts[0].oversized).toBe(true);
    expect(r.parts[0].pageCount).toBe(1);
  });

  it("reporta progresso monotônico até 100", async () => {
    const gw = new FakePdfGateway();
    gw.registerFile("A.pdf", [100, 200, 300]);
    const seen: number[] = [];

    await processPdfs(
      {
        sources: [{ id: "a", fileName: "A.pdf", data: bytes(10) }],
        maxSizeBytes: 10 * MB,
        outputPrefix: "Doc",
      },
      gw,
      (p) => seen.push(p),
    );

    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toBe(100);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it("isola arquivos com erro e continua os demais", async () => {
    const gw = new FakePdfGateway();
    gw.registerFile("Ok.pdf", [100]);
    gw.failWith("Locked.pdf", "encrypted");
    gw.failWith("Broken.pdf", "corrupt");

    const r = await processPdfs(
      {
        sources: [
          { id: "1", fileName: "Ok.pdf", data: bytes(10) },
          { id: "2", fileName: "Locked.pdf", data: bytes(10) },
          { id: "3", fileName: "Broken.pdf", data: bytes(10) },
        ],
        maxSizeBytes: 10 * MB,
        outputPrefix: "Doc",
      },
      gw,
    );

    expect(r.parts).toHaveLength(1);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped.map((s) => s.code).sort()).toEqual(["CORRUPT_PDF", "ENCRYPTED_PDF"]);
  });

  it("rejeita entrada vazia e excesso de arquivos", async () => {
    const gw = new FakePdfGateway();
    const empty = await processPdfs({ sources: [], maxSizeBytes: 2_800_000, outputPrefix: "Doc" }, gw);
    expect(empty.parts).toEqual([]);

    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      id: String(i),
      fileName: `F${i}.pdf`,
      data: bytes(10),
    }));
    await expect(
      processPdfs({ sources: tooMany, maxSizeBytes: 2_800_000, outputPrefix: "Doc" }, gw),
    ).rejects.toThrow();
  });

  it("expõe yieldToEventLoop para teste de fluidez", () => {
    expect(typeof __testUtils.yieldToEventLoop).toBe("function");
  });

  it("não chama pdf-lib diretamente (DIP)", async () => {
    const gw = new FakePdfGateway();
    const spy = vi.spyOn(gw, "save");
    gw.registerFile("A.pdf", [100]);
    await processPdfs(
      { sources: [{ id: "a", fileName: "A.pdf", data: bytes(10) }], maxSizeBytes: 10 * MB, outputPrefix: "Doc" },
      gw,
    );
    expect(spy).toHaveBeenCalled();
  });
});
