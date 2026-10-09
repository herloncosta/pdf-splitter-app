import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mockProcess = vi.fn();

vi.mock("@/interface/hooks/usePdfProcessor", () => ({
  usePdfProcessor: () => ({
    isProcessing: false,
    progress: 0,
    results: [],
    skipped: [],
    error: null,
    process: mockProcess,
    reset: vi.fn(),
  }),
}));

vi.mock("@/application/use-cases/probe-page-count", () => ({
  probePageCount: vi.fn().mockResolvedValue(2),
}));

import HomePage from "@/app/page";

describe("HomePage (T43)", () => {
  beforeEach(() => {
    mockProcess.mockClear();
    // jsdom não implementa Blob.arrayBuffer: define leitura mínima para o teste
    Object.defineProperty(File.prototype, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer as ArrayBuffer,
      configurable: true,
    });
  });

  it("botão desabilitado sem arquivos; habilita após adicionar PDF", async () => {
    render(<HomePage />);
    const btn = screen.getByRole("button", { name: /unificar e dividir/i });
    expect(btn).toBeDisabled();

    const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("pdf-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [pdf], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText("doc.pdf")).toBeInTheDocument();
    expect(await screen.findByText(/2 pág/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unificar e dividir \(1\)/i })).toBeEnabled();
  });

  it("processa com prefixo e limite padrão", async () => {
    render(<HomePage />);
    const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("pdf-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [pdf], configurable: true });
    fireEvent.change(input);
    await screen.findByText("doc.pdf");

    fireEvent.click(screen.getByRole("button", { name: /unificar e dividir \(1\)/i }));
    await vi.waitFor(() => expect(mockProcess).toHaveBeenCalled());
    const [inputs, limit, pfx] = mockProcess.mock.calls[0];
    expect(inputs).toHaveLength(1);
    expect(limit).toBe(2_800_000);
    expect(pfx).toBe("Documento_Processado");
  });
});
