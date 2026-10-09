const FORBIDDEN = /[\\/:*?"<>|]/g;
const MAX_LEN = 60;

export class OutputPrefix {
  readonly value: string;

  constructor(raw: string) {
    const cleaned = (raw ?? "").replace(FORBIDDEN, "_").trim().slice(0, MAX_LEN);
    this.value = cleaned.length > 0 ? cleaned : "Documento";
  }
}

export function buildPartName(prefix: OutputPrefix, index: number): string {
  return `${prefix.value}_Parte_${String(index).padStart(2, "0")}.pdf`;
}
