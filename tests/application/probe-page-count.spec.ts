import { describe, expect, it, vi } from "vitest";
import { CorruptPdfError } from "@/domain/errors/pdf-errors";
import {
  clearProbeCache,
  probePageCount,
} from "@/application/use-cases/probe-page-count";

describe("probePageCount (T22)", () => {
  it("retorna contagem e usa cache na segunda chamada", async () => {
    clearProbeCache();
    const gateway = { probePageCount: vi.fn().mockResolvedValue(7) };
    const data = new Uint8Array([1, 2, 3]);

    expect(await probePageCount(data, "A.pdf", gateway as never)).toBe(7);
    expect(await probePageCount(data, "A.pdf", gateway as never)).toBe(7);
    expect(gateway.probePageCount).toHaveBeenCalledTimes(1);
  });

  it("propaga erro de PDF corrompido", async () => {
    clearProbeCache();
    const gateway = {
      probePageCount: vi.fn().mockRejectedValue(new CorruptPdfError("X.pdf")),
    };
    await expect(probePageCount(new Uint8Array([9]), "X.pdf", gateway as never)).rejects.toBeInstanceOf(
      CorruptPdfError,
    );
  });
});
