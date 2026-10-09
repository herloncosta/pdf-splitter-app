import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { JsZipGatewayAdapter } from "@/infrastructure/zip/jszip-gateway.adapter";

describe("JsZipGatewayAdapter (T31)", () => {
  it("gera zip com as entradas e lê de volta", async () => {
    const gw = new JsZipGatewayAdapter();
    const zipBytes = await gw.createZip([
      { name: "Doc_Parte_01.pdf", data: new Uint8Array([1, 2, 3]) },
      { name: "Doc_Parte_02.pdf", data: new Uint8Array([4, 5]) },
    ]);

    const back = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(back.files).sort()).toEqual(["Doc_Parte_01.pdf", "Doc_Parte_02.pdf"]);
    expect((await back.files["Doc_Parte_01.pdf"].async("uint8array")).length).toBe(3);
  });
});
