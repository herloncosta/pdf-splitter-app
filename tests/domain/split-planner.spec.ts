import { describe, expect, it } from "vitest";
import { planSplit } from "@/domain/services/split-planner";

const MB = 1_000_000;

describe("SplitPlanner (T13)", () => {
  it("agrupa sem estourar o limite", () => {
    const r = planSplit([1 * MB, 1 * MB, 1 * MB], 2.8 * MB);
    expect(r.parts).toEqual([
      [0, 1],
      [2],
    ]);
    expect(r.oversizedIndices).toEqual([]);
  });

  it("página única maior que o limite vira oversized", () => {
    const r = planSplit([5 * MB], 2.8 * MB);
    expect(r.parts).toEqual([[0]]);
    expect(r.oversizedIndices).toEqual([0]);
  });

  it("lista vazia retorna vazio", () => {
    expect(planSplit([], 2.8 * MB)).toEqual({ parts: [], oversizedIndices: [] });
  });

  it("isola oversized no meio sem perder ordem", () => {
    const r = planSplit([1 * MB, 5 * MB, 1 * MB], 2.8 * MB);
    expect(r.parts).toEqual([[0], [1], [2]]);
    expect(r.oversizedIndices).toEqual([1]);
  });
});
