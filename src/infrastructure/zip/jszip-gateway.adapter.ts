import JSZip from "jszip";
import type {
  IZipGateway,
  ZipEntry,
} from "@/application/ports/zip-gateway.port";

/** PDFs já são comprimidos: STORE é mais rápido que DEFLATE sem ganho real. */
export class JsZipGatewayAdapter implements IZipGateway {
  async createZip(entries: ZipEntry[]): Promise<Uint8Array> {
    const zip = new JSZip();
    for (const e of entries) zip.file(e.name, e.data, { binary: true });
    return await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  }
}
