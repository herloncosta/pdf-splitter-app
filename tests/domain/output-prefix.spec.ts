import { describe, expect, it } from "vitest";
import {
  OutputPrefix,
  buildPartName,
} from "@/domain/value-objects/output-prefix";

describe("OutputPrefix (T11)", () => {
  it("sanitiza caracteres proibidos no Windows", () => {
    expect(new OutputPrefix("Doc: Final/v2*?").value).toBe("Doc_ Final_v2__");
  });

  it("usa fallback quando vazio", () => {
    expect(new OutputPrefix("   ").value).toBe("Documento");
  });

  it("trunca em 60 chars", () => {
    expect(new OutputPrefix("a".repeat(80)).value).toHaveLength(60);
  });

  it("monta nome da parte com padding", () => {
    expect(buildPartName(new OutputPrefix("Contrato"), 1)).toBe(
      "Contrato_Parte_01.pdf",
    );
  });
});
