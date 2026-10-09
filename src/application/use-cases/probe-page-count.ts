import type { IPdfGateway } from "@/application/ports/pdf-gateway.port";

const cache = new Map<string, number>();

function fingerprint(data: Uint8Array): string {
  const head = Array.from(data.slice(0, 32)).join(",");
  const tail = Array.from(data.slice(-32)).join(",");
  return `${data.length}:${head}:${tail}`;
}

export function probeCacheKey(fileName: string, data: Uint8Array): string {
  return `${fileName}#${fingerprint(data)}`;
}

export async function probePageCount(
  data: Uint8Array,
  fileName: string,
  gateway: IPdfGateway,
): Promise<number> {
  const key = probeCacheKey(fileName, data);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const n = await gateway.probePageCount(data, fileName);
  cache.set(key, n);
  return n;
}

export function clearProbeCache(): void {
  cache.clear();
}
