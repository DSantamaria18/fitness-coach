import { describe, expect, it } from "vitest";
import {
  computeComparisonPeriods,
  parseComparisonPreset,
} from "./comparison-periods";

describe("parseComparisonPreset", () => {
  it("acepta 'mes' y 'anio'", () => {
    expect(parseComparisonPreset("mes")).toBe("mes");
    expect(parseComparisonPreset("anio")).toBe("anio");
  });

  it("ignora valores ausentes o inválidos en vez de romper la página", () => {
    expect(parseComparisonPreset(undefined)).toBeUndefined();
    expect(parseComparisonPreset("")).toBeUndefined();
    expect(parseComparisonPreset("semana")).toBeUndefined();
    expect(parseComparisonPreset("año")).toBeUndefined();
  });
});

describe("computeComparisonPeriods", () => {
  it("preset 'mes': un día cualquiera del mes", () => {
    const now = new Date("2026-07-19T10:30:00.000Z");

    const result = computeComparisonPeriods("mes", now);

    expect(result.actual).toEqual({
      desde: "2026-07-01T00:00:00.000Z",
      hasta: "2026-07-19T23:59:59.999Z",
    });
    expect(result.anterior).toEqual({
      desde: "2026-06-01T00:00:00.000Z",
      hasta: "2026-06-30T23:59:59.999Z",
    });
  });

  it("preset 'mes': caso borde del día 1 del mes", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");

    const result = computeComparisonPeriods("mes", now);

    expect(result.actual).toEqual({
      desde: "2026-03-01T00:00:00.000Z",
      hasta: "2026-03-01T23:59:59.999Z",
    });
    expect(result.anterior).toEqual({
      desde: "2026-02-01T00:00:00.000Z",
      hasta: "2026-02-28T23:59:59.999Z",
    });
  });

  it("preset 'mes': caso borde de enero, el mes anterior cae en el año previo", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");

    const result = computeComparisonPeriods("mes", now);

    expect(result.actual.desde).toBe("2026-01-01T00:00:00.000Z");
    expect(result.anterior).toEqual({
      desde: "2025-12-01T00:00:00.000Z",
      hasta: "2025-12-31T23:59:59.999Z",
    });
  });

  it("preset 'anio': un día cualquiera del año", () => {
    const now = new Date("2026-07-19T10:30:00.000Z");

    const result = computeComparisonPeriods("anio", now);

    expect(result.actual).toEqual({
      desde: "2026-01-01T00:00:00.000Z",
      hasta: "2026-07-19T23:59:59.999Z",
    });
    expect(result.anterior).toEqual({
      desde: "2025-01-01T00:00:00.000Z",
      hasta: "2025-12-31T23:59:59.999Z",
    });
  });

  it("preset 'anio': caso borde del 1 de enero", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    const result = computeComparisonPeriods("anio", now);

    expect(result.actual).toEqual({
      desde: "2026-01-01T00:00:00.000Z",
      hasta: "2026-01-01T23:59:59.999Z",
    });
    expect(result.anterior).toEqual({
      desde: "2025-01-01T00:00:00.000Z",
      hasta: "2025-12-31T23:59:59.999Z",
    });
  });
});
