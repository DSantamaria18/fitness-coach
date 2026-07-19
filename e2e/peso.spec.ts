import { test, expect } from "@playwright/test";
import { login } from "./support/login";
import { gotoReady } from "./support/navigation";

test("registrar peso corporal aparece en el historial", async ({ page }) => {
  await login(page);
  await gotoReady(page, "/peso");

  // Valor poco probable de colisionar con otros specs que comparten el
  // mismo SQLite de E2E (ver global-setup.ts).
  await page.getByLabel("Peso (kg)").fill("73.4");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("¡Peso guardado!")).toBeVisible();

  await page.goto("/historial");
  await expect(page.getByText("73.4 kg")).toBeVisible();
});
