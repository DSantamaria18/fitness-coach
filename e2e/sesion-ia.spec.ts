import { test, expect } from "@playwright/test";
import { login } from "./support/login";
import { gotoReady } from "./support/navigation";
import { MOCK_SESSION_PROPOSAL } from "./mock-anthropic-server";

// Este es el test que habría atrapado, sin gastar un céntimo real, el bug
// de RSC de buildInitialRegistros (ver DECISIONS.md 2026-07-19): un Runtime
// Error 500 determinista en cualquier éxito de "Generar propuesta con IA",
// porque solo depende de cruzar la frontera servidor/cliente, no de que la
// respuesta del modelo sea real.
test("Generar propuesta con IA precarga el formulario y sigue siendo editable", async ({
  page,
}) => {
  await login(page);
  await gotoReady(page, "/sesion");

  await page.getByRole("button", { name: "Generar propuesta con IA" }).click();

  await expect(
    page.getByRole("heading", { name: MOCK_SESSION_PROPOSAL.ejercicio }),
  ).toBeVisible();

  const reps = page.getByLabel("Reps");
  const pesoKg = page.getByLabel("Peso (kg)");
  const rpe = page.getByLabel("RPE");

  await expect(reps).toHaveValue(String(MOCK_SESSION_PROPOSAL.reps));
  await expect(pesoKg).toHaveValue(String(MOCK_SESSION_PROPOSAL.pesoKg));
  await expect(rpe).toHaveValue(String(MOCK_SESSION_PROPOSAL.rpe));

  // El formulario prellenado por la IA debe seguir siendo editable a mano,
  // no de solo lectura.
  await reps.fill("6");
  await expect(reps).toHaveValue("6");

  await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
});
