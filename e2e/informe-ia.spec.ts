import { test, expect } from "@playwright/test";
import { login } from "./support/login";
import { gotoReady } from "./support/navigation";
import { MOCK_PROGRESS_COMMENT_TEXT } from "./mock-anthropic-server";

test("Generar comentario de progreso muestra el texto generado", async ({
  page,
}) => {
  await login(page);
  await gotoReady(page, "/informe");

  await page
    .getByRole("button", { name: "Generar comentario de progreso" })
    .click();

  await expect(page.getByText(MOCK_PROGRESS_COMMENT_TEXT)).toBeVisible();
});
