export const SAFE_3MB_BYTES = 2_800_000;

export class SizeLimit {
  readonly bytes: number;

  constructor(bytes: number = SAFE_3MB_BYTES) {
    if (!Number.isInteger(bytes) || bytes <= 0) {
      throw new Error("SizeLimit inválido: esperado inteiro positivo em bytes");
    }
    this.bytes = bytes;
  }
}
