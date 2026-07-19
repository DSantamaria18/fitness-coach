import { test, expect } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USERNAME } from "./env";
import { gotoReady } from "./support/navigation";

test.describe("Login", () => {
  test("credenciales correctas redirige al historial", async ({ page }) => {
    await gotoReady(page, "/login");
    await page.getByLabel("Usuario").fill(ADMIN_USERNAME);
    await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL("/historial");
    await expect(
      page.getByRole("heading", { name: "Historial" }),
    ).toBeVisible();
  });

  test("credenciales incorrectas muestra un error y no navega", async ({
    page,
  }) => {
    await gotoReady(page, "/login");
    await page.getByLabel("Usuario").fill(ADMIN_USERNAME);
    await page.getByLabel("Contraseña").fill("password-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Next.js añade su propio `role="alert"` (el "route announcer",
    // siempre vacío) para accesibilidad de navegación — filtrar por texto
    // evita una violación de "strict mode" al haber dos elementos con ese
    // rol en la página.
    await expect(
      page.getByRole("alert").filter({ hasText: "incorrectos" }),
    ).toHaveText("Usuario o contraseña incorrectos.");
    await expect(page).toHaveURL(/\/login$/);
  });
});
