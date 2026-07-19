import { describe, expect, it } from "vitest";
import { parseDateRangeSearchParams } from "./parse-date-range";

describe("parseDateRangeSearchParams", () => {
  it("devuelve valores vacíos y sin filtros cuando no hay parámetros", () => {
    const result = parseDateRangeSearchParams({});

    expect(result).toEqual({
      raw: { desde: "", hasta: "" },
      filters: {},
    });
  });

  it("convierte 'desde' a inicio de día ISO (medianoche UTC)", () => {
    const result = parseDateRangeSearchParams({ desde: "2026-07-01" });

    expect(result.raw.desde).toBe("2026-07-01");
    expect(result.filters.desde).toBe("2026-07-01T00:00:00.000Z");
    expect(result.filters.hasta).toBeUndefined();
  });

  it("convierte 'hasta' a fin de día ISO (23:59:59.999 UTC)", () => {
    const result = parseDateRangeSearchParams({ hasta: "2026-07-15" });

    expect(result.raw.hasta).toBe("2026-07-15");
    expect(result.filters.hasta).toBe("2026-07-15T23:59:59.999Z");
    expect(result.filters.desde).toBeUndefined();
  });

  it("convierte ambos límites cuando se indican los dos", () => {
    const result = parseDateRangeSearchParams({
      desde: "2026-06-01",
      hasta: "2026-06-30",
    });

    expect(result.raw).toEqual({ desde: "2026-06-01", hasta: "2026-06-30" });
    expect(result.filters).toEqual({
      desde: "2026-06-01T00:00:00.000Z",
      hasta: "2026-06-30T23:59:59.999Z",
    });
  });

  it("ignora un 'desde' con formato inválido en vez de romper la página", () => {
    const result = parseDateRangeSearchParams({
      desde: "no-es-una-fecha",
      hasta: "2026-07-15",
    });

    expect(result.raw.desde).toBe("");
    expect(result.filters.desde).toBeUndefined();
    expect(result.filters.hasta).toBe("2026-07-15T23:59:59.999Z");
  });

  it("ignora una fecha de calendario inexistente (p.ej. 30 de febrero)", () => {
    const result = parseDateRangeSearchParams({ hasta: "2026-02-30" });

    expect(result.raw.hasta).toBe("");
    expect(result.filters.hasta).toBeUndefined();
  });
});
