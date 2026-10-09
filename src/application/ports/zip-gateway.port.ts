export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export interface IZipGateway {
  createZip(entries: ZipEntry[]): Promise<Uint8Array>;
}
