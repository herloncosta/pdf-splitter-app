import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DownloadSection } from "@/interface/components/DownloadSection";
import type { ProcessedPartView } from "@/interface/hooks/usePdfProcessor";

function part(overrides: Partial<ProcessedPartView> = {}): ProcessedPartView {
  return {
    name: "Doc_Parte_01.pdf",
    sizeBytes: 1_500_000,
    pageCount: 4,
    oversized: false,
    blob: new Blob(["x"], { type: "application/pdf" }),
    url: "blob:1",
    ...overrides,
  };
}

describe("DownloadSection (T44)", () => {
  it("lista partes com tamanho e páginas", () => {
    render(<DownloadSection parts={[part()]} zipping={false} zipUrl={null} onDownloadZip={vi.fn()} />);
    expect(screen.getByText(/doc_parte_01\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/4 pág/)).toBeInTheDocument();
  });

  it("alerta partes oversized", () => {
    render(
      <DownloadSection parts={[part({ name: "Big_Parte_01.pdf", oversized: true, url: "blob:9" })]} zipping={false} zipUrl={null} onDownloadZip={vi.fn()} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/excede.*sozinha/i);
  });

  it("botão zip chama callback e mostra link quando pronto", () => {
    const onDownloadZip = vi.fn();
    const { rerender } = render(<DownloadSection parts={[part()]} zipping={false} zipUrl={null} onDownloadZip={onDownloadZip} />);
    fireEvent.click(screen.getByRole("button", { name: /baixar tudo/i }));
    expect(onDownloadZip).toHaveBeenCalledOnce();

    rerender(<DownloadSection parts={[part()]} zipping={false} zipUrl="blob:zip" onDownloadZip={onDownloadZip} />);
    expect(screen.getByRole("link", { name: /salvar zip/i })).toHaveAttribute("href", "blob:zip");
  });
});
