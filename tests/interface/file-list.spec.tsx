import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FileList } from "@/interface/components/FileList";
import type { PdfSourceView } from "@/interface/components/pdf-source";

function src(id: string, name: string): PdfSourceView {
  return {
    id,
    file: new File(["x"], name, { type: "application/pdf" }),
    fileName: name,
    sizeBytes: 1500,
    pageCount: 3,
    status: "ready",
  };
}

describe("FileList (T41)", () => {
  it("exibe tamanho e páginas, remove item", () => {
    const onRemove = vi.fn();
    const onReorder = vi.fn();
    render(<FileList sources={[src("a", "A.pdf")]} onReorder={onReorder} onRemove={onRemove} />);

    expect(screen.getByText("A.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1\.5 KB/)).toBeInTheDocument();
    expect(screen.getByText(/3 pág/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remover a\.pdf/i }));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("reordena via botões acessíveis (fallback teclado)", () => {
    const onReorder = vi.fn();
    render(
      <FileList sources={[src("a", "A.pdf"), src("b", "B.pdf"), src("c", "C.pdf")]} onReorder={onReorder} onRemove={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mover a\.pdf para baixo/i }));
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c"]);

    fireEvent.click(screen.getByRole("button", { name: /mover c\.pdf para cima/i }));
    expect(onReorder).toHaveBeenCalledWith(["a", "c", "b"]);
  });

  it("lista vazia mostra estado vazio", () => {
    render(<FileList sources={[]} onReorder={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/nenhum pdf/i)).toBeInTheDocument();
  });
});
