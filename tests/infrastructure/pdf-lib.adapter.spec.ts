import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PdfLibGatewayAdapter } from "@/infrastructure/pdf/pdf-lib-gateway.adapter";
import { CorruptPdfError } from "@/domain/errors/pdf-errors";

async function makePdfBytes(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return await doc.save();
}

describe("PdfLibGatewayAdapter (T30)", () => {
  it("load + pageCount + round-trip", async () => {
    const gw = new PdfLibGatewayAdapter();
    const data = await makePdfBytes(2);

    const h = await gw.loadDocument(data, "A.pdf");
    expect(gw.getPageCount(h)).toBe(2);

    const dest = await gw.createDocument();
    await gw.copyPages(h, [0, 1], dest);
    const out = await gw.save(dest);
    expect(out.length).toBeGreaterThan(0);

    const h2 = await gw.loadDocument(out, "out.pdf");
    expect(gw.getPageCount(h2)).toBe(2);
  });

  it("estima tamanho de página isolada", async () => {
    const gw = new PdfLibGatewayAdapter();
    const h = await gw.loadDocument(await makePdfBytes(3), "A.pdf");
    const s = await gw.getSinglePageSize(h, 0);
    expect(s).toBeGreaterThan(0);
    expect(await gw.probePageCount(await makePdfBytes(3), "A.pdf")).toBe(3);
  });

  it("bytes aleatórios viram CorruptPdfError", async () => {
    const gw = new PdfLibGatewayAdapter();
    await expect(gw.loadDocument(new Uint8Array([1, 2, 3, 4]), "X.pdf")).rejects.toBeInstanceOf(
      CorruptPdfError,
    );
  });
});
