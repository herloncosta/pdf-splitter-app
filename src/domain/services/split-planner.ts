export interface SplitPlan {
  parts: number[][];
  oversizedIndices: number[];
}

/** Greedy puro: agrupa páginas sem estourar o limite. Página única > limite vira parte oversized. */
export function planSplit(
  pageSizes: number[],
  limitBytes: number,
): SplitPlan {
  const parts: number[][] = [];
  const oversizedIndices: number[] = [];
  let current: number[] = [];
  let currentSize = 0;

  for (let i = 0; i < pageSizes.length; i++) {
    const size = pageSizes[i];

    if (size > limitBytes) {
      if (current.length > 0) {
        parts.push(current);
        current = [];
        currentSize = 0;
      }
      parts.push([i]);
      oversizedIndices.push(i);
      continue;
    }

    if (currentSize + size > limitBytes && current.length > 0) {
      parts.push(current);
      current = [i];
      currentSize = size;
    } else {
      current.push(i);
      currentSize += size;
    }
  }

  if (current.length > 0) parts.push(current);
  return { parts, oversizedIndices };
}
