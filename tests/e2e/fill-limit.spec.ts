import { expect, test } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(__dirname, "fixtures");

/**
 * Prova de preenchimento máximo em PDF real: 10 páginas de ~367KB
 * (total ~3.7MB) com limite 2.8MB DEVEM gerar 2 partes, com a primeira
 * colada no limite (≥2.0MB) — nunca 4+ partes de <1MB como o planejador
 * por estimativa fazia ao contar recursos compartilhados 2x.
 */
test("fill: partes exploram o limite de 2.8MB (T60)", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pdf-input").setInputFiles([join(fixtures, "fill-10pages.pdf")]);

  await expect(page.getByText("fill-10pages.pdf")).toBeVisible();
  await expect(page.getByText(/10 pág/).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /unificar e dividir \(1\)/i }).click();
  await expect(page.getByText(/partes geradas \(2\)/i)).toBeVisible({ timeout: 60_000 });

  const downloads = page.getByRole("region", { name: /downloads/i });
  await expect(downloads.getByText(/[23]\.\d MB/).first()).toBeVisible();
  await expect(downloads.getByRole("alert")).toHaveCount(0);
});
