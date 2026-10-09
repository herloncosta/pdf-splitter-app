import { expect, test } from "@playwright/test";
import { join } from "node:path";

const fixtures = join(__dirname, "fixtures");

test("happy-path: upload 2 PDFs → split → zip (T60)", async ({ page }) => {
  // T51: privacidade — nenhum request para fora de localhost durante tudo
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") external.push(req.url());
  });

  await page.goto("/");

  // upload ordenado: a (2 págs) depois b (1 pág)
  await page.getByTestId("pdf-input").setInputFiles([
    join(fixtures, "a-2pages.pdf"),
    join(fixtures, "b-1page.pdf"),
  ]);

  await expect(page.getByText("a-2pages.pdf")).toBeVisible();
  await expect(page.getByText("b-1page.pdf")).toBeVisible();
  await expect(page.getByText(/2 pág/).first()).toBeVisible({ timeout: 15_000 });

  // processa com default 2.8MB → 1 parte com 3 páginas
  await page.getByRole("button", { name: /unificar e dividir \(2\)/i }).click();
  await expect(page.getByText(/partes geradas \(1\)/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: /downloads/i }).getByText(/3 pág/)).toBeVisible();

  // zip: gera e baixa
  await page.getByRole("button", { name: /baixar tudo/i }).click();
  const zipLink = page.getByRole("link", { name: /salvar zip/i });
  await expect(zipLink).toBeVisible({ timeout: 15_000 });
  const download = page.waitForEvent("download", { timeout: 15_000 });
  await zipLink.click();
  const dl = await download;
  expect(dl.suggestedFilename()).toMatch(/\.zip$/);
  expect(external).toEqual([]);
});
