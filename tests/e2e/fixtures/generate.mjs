/** Gera fixtures PDF determinísticas para o E2E. Rode com: node tests/e2e/fixtures/generate.mjs */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const dir = dirname(fileURLToPath(import.meta.url));

// PRNG determinístico (mulberry32) para fixtures estáveis entre runs
let seed = 42;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randomText = (n) => Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");

// PNG com ruído (alta entropia, quase não comprime) para recurso compartilhado
function makePng(w, h) {
  const raw = Buffer.alloc((1 + w * 3) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w * 3; x++) raw[o++] = Math.floor(rand() * 256);
  }
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = (table[(c ^ b) & 255] ^ (c >>> 8)) | 0;
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cs = Buffer.alloc(4);
    cs.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cs]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function make(pages, label) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${label} — página ${i + 1}/${pages}`, {
      x: 50,
      y: 750,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
  }
  return await doc.save();
}

mkdirSync(dir, { recursive: true });
for (const [name, pages] of [["a-2pages", 2], ["b-1page", 1]]) {
  const bytes = await make(pages, name);
  writeFileSync(join(dir, `${name}.pdf`), bytes);
  console.log(`fixture ${name}.pdf: ${pages} páginas, ${bytes.length} bytes`);
}

// fill-10pages: ~400KB de texto NÃO-comprimível por página (pdf-lib aplica
// Flate nos streams, então usa entropia alta) → ~4MB no total, força 2 partes
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 10; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`FILL p${i + 1}/10 ` + randomText(400_000), { x: 20, y: 800, size: 8, font, color: rgb(0, 0, 0) });
  }
  const bytes = await doc.save();
  writeFileSync(join(dir, "fill-10pages.pdf"), bytes);
  console.log(`fixture fill-10pages.pdf: 10 páginas, ${bytes.length} bytes`);
}

// shared-10pages: 1 imagem de ~1.9MB desenhada nas 10 páginas (recurso
// COMPARTILHADO) + ~190KB de texto único por página → ~3.8MB no total.
// Regressão do bug de duplicação: copiando página-a-página em chamadas
// separadas, a imagem era duplicada a cada cópia (45KB→436KB medido) e
// gerava ~10 partes; em lote gera 2–3 partes cheias.
{
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const img = await doc.embedPng(makePng(800, 800));
  for (let i = 0; i < 10; i++) {
    const page = doc.addPage([595, 842]);
    page.drawImage(img, { x: 50, y: 400, width: 200, height: 200 });
    page.drawText(`SHARED p${i + 1}/10 ` + randomText(200_000), { x: 20, y: 800, size: 8, font, color: rgb(0, 0, 0) });
  }
  const bytes = await doc.save();
  writeFileSync(join(dir, "shared-10pages.pdf"), bytes);
  console.log(`fixture shared-10pages.pdf: 10 páginas, ${bytes.length} bytes`);
}
