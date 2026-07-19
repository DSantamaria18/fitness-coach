import { describe, expect, it } from "vitest";
import { buildStreakCaption } from "./streak-caption";

describe("buildStreakCaption", () => {
  it("usa el texto por defecto cuando no hay filtro 'hasta' aplicado", () => {
    expect(buildStreakCaption(false)).toBe(
      "Semanas consecutivas con al menos una sesión, contando hacia atrás desde hoy.",
    );
  });

  it("advierte de que la racha ignora el filtro 'hasta' cuando está aplicado", () => {
    const caption = buildStreakCaption(true);

    expect(caption).toMatch(/ignora/i);
    expect(caption).toMatch(/hasta/i);
    // Debe seguir explicando el criterio base de cálculo, no solo el aviso.
    expect(caption).toMatch(/hoy/i);
  });
});
