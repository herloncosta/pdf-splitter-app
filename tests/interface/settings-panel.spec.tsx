import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPanel } from "@/interface/components/SettingsPanel";

describe("SettingsPanel (T42)", () => {
  it("seleciona preset decimal 4.8MB → 4_800_000 bytes", () => {
    const onLimitChange = vi.fn();
    render(
      <SettingsPanel outputPrefix="Doc" maxSizeBytes={2_800_000} onPrefixChange={vi.fn()} onLimitChange={onLimitChange} />,
    );
    fireEvent.click(screen.getByLabelText("4.8 MB"));
    expect(onLimitChange).toHaveBeenCalledWith(4_800_000);
  });

  it("custom zero mostra erro e não emite", () => {
    const onLimitChange = vi.fn();
    render(
      <SettingsPanel outputPrefix="Doc" maxSizeBytes={2_800_000} onPrefixChange={vi.fn()} onLimitChange={onLimitChange} />,
    );
    fireEvent.change(screen.getByLabelText(/personalizado em mb/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/maior que zero/i);
    expect(onLimitChange).not.toHaveBeenCalled();
  });

  it("custom 5MB → 5_000_000 bytes (decimal, não MiB)", () => {
    const onLimitChange = vi.fn();
    render(
      <SettingsPanel outputPrefix="Doc" maxSizeBytes={2_800_000} onPrefixChange={vi.fn()} onLimitChange={onLimitChange} />,
    );
    fireEvent.change(screen.getByLabelText(/personalizado em mb/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(onLimitChange).toHaveBeenCalledWith(5_000_000);
  });

  it("edita prefixo", () => {
    const onPrefixChange = vi.fn();
    render(
      <SettingsPanel outputPrefix="Doc" maxSizeBytes={2_800_000} onPrefixChange={onPrefixChange} onLimitChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/prefixo/i), { target: { value: "Contrato" } });
    expect(onPrefixChange).toHaveBeenCalledWith("Contrato");
  });
});
