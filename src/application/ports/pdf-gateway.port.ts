/** Handle opaco de um documento dentro do gateway (DIP: application não conhece pdf-lib). */
export type PdfHandle = string;

export interface IPdfGateway {
  createDocument(): Promise<PdfHandle>;
  loadDocument(data: Uint8Array, fileName: string): Promise<PdfHandle>;
  getPageCount(handle: PdfHandle): number;
  copyPages(src: PdfHandle, srcIndices: number[], dest: PdfHandle): Promise<void>;
  save(handle: PdfHandle): Promise<Uint8Array>;
  probePageCount(data: Uint8Array, fileName: string): Promise<number>;
}
