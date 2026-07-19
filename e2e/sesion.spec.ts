import { test, expect } from "@playwright/test";
import { login } from "./support/login";
import { gotoReady } from "./support/navigation";

test("registrar una sesión de fuerza aparece en el historial", async ({
  page,
}) => {
  await login(page);
  await gotoReady(page, "/sesion");

  await page
    .getByLabel("Añadir ejercicio")
    .selectOption({ label: "Sentadilla" });
  await page.getByRole("button", { name: "Añadir", exact: true }).click();

  await page.getByLabel("Reps").fill("5");
  await page.getByLabel("Peso (kg)").fill("80");
  await page.getByLabel("Tempo").fill("2010");
  await page.getByLabel("RPE").fill("8");

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("¡Sesión guardada!")).toBeVisible();

  await page.goto("/historial");
  await expect(
    page.getByRole("heading", { name: "Sesiones de entreno" }),
  ).toBeVisible();
  await expect(page.getByText("5×80kg", { exact: false })).toBeVisible();
});
