import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePdfProcessor } from "@/interface/hooks/usePdfProcessor";

describe("usePdfProcessor (T32)", () => {
  it("transiciona processando → resultados com progresso", async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => {
        const u = `blob:${created.length}`;
        created.push(u);
        return u;
      }),
      revokeObjectURL: vi.fn((u: string) => void revoked.push(u)),
    });

    const runProcess = vi.fn(async ({ onProgress }: { onProgress: (p: number) => void }) => {
      onProgress(10);
      onProgress(50);
      return {
        parts: [
          { name: "Doc_Parte_01.pdf", data: new Uint8Array([1, 2]), sizeBytes: 2, pageCount: 1, oversized: false },
        ],
        skipped: [],
      };
    });

    const { result, unmount } = renderHook(() => usePdfProcessor({ runProcess }));

    await act(async () => {
      await result.current.process([{ id: "a", fileName: "A.pdf", data: new Uint8Array([9]) }], 2_800_000, "Doc");
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].url).toBe("blob:0");
    expect(runProcess).toHaveBeenCalledOnce();

    unmount();
    expect(revoked).toEqual(created);
    vi.unstubAllGlobals();
  });

  it("expõe erro sem travar em processando", async () => {
    const runProcess = vi.fn(async () => {
      throw new Error("Limite de 20 arquivos excedido");
    });
    const { result } = renderHook(() => usePdfProcessor({ runProcess }));

    await act(async () => {
      await result.current.process([], 2_800_000, "Doc");
    });

    expect(result.current.error).toBe("Limite de 20 arquivos excedido");
    expect(result.current.isProcessing).toBe(false);
  });
});
