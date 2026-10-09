import { expect, test } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(__dirname, "fixtures");

/**
 * Regressão do bug de duplicação de recursos compartilhados: 10 páginas
 * dividindo 1 imagem de ~1.9MB (~3.8MB no total). Copiando página-a-página
 * em chamadas separadas o pdf-lib duplicava a imagem a cada cópia e gerava
 * ~10 partes; com rebuild em lote por tentativa gera 2–4 partes cheias.
 */
test("shared: imagem compartilhada não duplica nem fragmenta (T60)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pdf-input").setInputFiles([join(fixtures, "shared-10pages.pdf")]);

  await expect(page.getByText("shared-10pages.pdf")).toBeVisible();
  await expect(page.getByText(/10 pág/).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /unificar e dividir \(1\)/i }).click();
  await expect(page.getByText(/partes geradas \([234]\)/i)).toBeVisible({ timeout: 120_000 });

  const downloads = page.getByRole("region", { name: /downloads/i });
  await expect(downloads.getByText(/[23]\.\d MB/).first()).toBeVisible();
  await expect(downloads.getByRole("alert")).toHaveCount(0);
});
