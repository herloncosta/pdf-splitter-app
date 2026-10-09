import { describe, expect, it } from "vitest";
import { SAFE_3MB_BYTES, SizeLimit } from "@/domain/value-objects/size-limit";

describe("SizeLimit (T10)", () => {
  it("usa default seguro para portais de 3MB", () => {
    expect(new SizeLimit().bytes).toBe(2_800_000);
    expect(SAFE_3MB_BYTES).toBe(2_800_000);
  });

  it("aceita custom válido", () => {
    expect(new SizeLimit(4_800_000).bytes).toBe(4_800_000);
  });

  it.each([0, -1, 1.5, NaN])("rejeita %p", (v) => {
    expect(() => new SizeLimit(v)).toThrow("SizeLimit inválido");
  });
});
