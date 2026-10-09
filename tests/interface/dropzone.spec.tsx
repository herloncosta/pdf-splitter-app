import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dropzone } from "@/interface/components/Dropzone";

function dropOnZone(files: File[]) {
  const zone = screen.getByRole("button", { name: /enviar arquivos pdf/i });
  fireEvent.drop(zone, { dataTransfer: { files, types: ["Files"] } });
}

describe("Dropzone (T40)", () => {
  it("aceita PDF e chama onFiles", async () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);
    const pdf = new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" });

    // via input direto (caminho estável no jsdom)
    const input = screen.getByTestId("pdf-input") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [pdf], configurable: true });
    fireEvent.change(input);

    // aguarda callback assíncrono do dropzone
    await vi.waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0][0][0].name).toBe("a.pdf");
  });

  it("rejeita não-PDF com alerta e sem callback", async () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);
    const txt = new File(["hello"], "a.txt", { type: "text/plain" });
    dropOnZone([txt]);

    expect(await screen.findByRole("alert")).toHaveTextContent(/somente PDF/i);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
