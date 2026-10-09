/** Handle opaco de um documento dentro do gateway (DIP: application não conhece pdf-lib). */
export type PdfHandle = string;

export interface IPdfGateway {
  createDocument(): Promise<PdfHandle>;
  loadDocument(data: Uint8Array, fileName: string): Promise<PdfHandle>;
  getPageCount(handle: PdfHandle): number;
  /** Tamanho estimado da página isolada (doc de 1 página serializado). */
  getSinglePageSize(handle: PdfHandle, pageIndex: number): Promise<number>;
  copyPages(src: PdfHandle, srcIndices: number[], dest: PdfHandle): Promise<void>;
  save(handle: PdfHandle): Promise<Uint8Array>;
  probePageCount(data: Uint8Array, fileName: string): Promise<number>;
}
