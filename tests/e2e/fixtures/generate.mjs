/** Gera fixtures PDF determinísticas para o E2E. Rode com: node tests/e2e/fixtures/generate.mjs */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

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
