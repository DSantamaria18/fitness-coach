import type { Page } from "@playwright/test";
import { ADMIN_PASSWORD, ADMIN_USERNAME } from "../env";
import { gotoReady } from "./navigation";

// Helper compartido por todos los specs salvo login.spec.ts: evita repetir
// el flujo de autenticación (formulario + submit + espera de la
// redirección real de la app tras login, "/" -> "/historial") en cada spec.
export async function login(page: Page) {
  await gotoReady(page, "/login");
  await page.getByLabel("Usuario").fill(ADMIN_USERNAME);
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/historial");
}
