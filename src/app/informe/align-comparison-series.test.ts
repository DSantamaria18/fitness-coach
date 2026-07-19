import { describe, expect, it } from "vitest";
import { alignComparisonSeries } from "./align-comparison-series";

describe("alignComparisonSeries", () => {
  it("devuelve un dataset vacío si ninguno de los dos periodos tiene puntos", () => {
    const result = alignComparisonSeries({
      actual: { points: [], periodStart: "2026-07-01T00:00:00.000Z" },
      anterior: { points: [], periodStart: "2026-06-01T00:00:00.000Z" },
    });

    expect(result).toEqual([]);
  });

  it("calcula el día relativo (1-indexado) respecto al inicio de cada periodo", () => {
    const result = alignComparisonSeries({
      actual: {
        points: [{ date: "2026-07-01T08:00:00.000Z", value: 80 }],
        periodStart: "2026-07-01T00:00:00.000Z",
      },
      anterior: {
        points: [{ date: "2026-06-03T08:00:00.000Z", value: 79 }],
        periodStart: "2026-06-01T00:00:00.000Z",
      },
    });

    // 1 de julio es el día 1 del periodo actual; 3 de junio es el día 3 del
    // periodo anterior (01→1, 02→2, 03→3).
    expect(result).toEqual([
      { diaRelativo: 1, actual: 80, anterior: null },
      { diaRelativo: 2, actual: null, anterior: null },
      { diaRelativo: 3, actual: null, anterior: 79 },
    ]);
  });

  it("extiende el eje hasta el máximo día relativo de ambos periodos, dejando huecos", () => {
    const result = alignComparisonSeries({
      actual: {
        // Periodo actual parcial: solo 3 días transcurridos.
        points: [
          { date: "2026-07-01T00:00:00.000Z", value: 80 },
          { date: "2026-07-03T00:00:00.000Z", value: 79.5 },
        ],
        periodStart: "2026-07-01T00:00:00.000Z",
      },
      anterior: {
        // Periodo anterior completo: 5 días con dato.
        points: [
          { date: "2026-06-01T00:00:00.000Z", value: 81 },
          { date: "2026-06-05T00:00:00.000Z", value: 80.5 },
        ],
        periodStart: "2026-06-01T00:00:00.000Z",
      },
    });

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ diaRelativo: 1, actual: 80, anterior: 81 });
    expect(result[1]).toEqual({ diaRelativo: 2, actual: null, anterior: null });
    expect(result[2]).toEqual({ diaRelativo: 3, actual: 79.5, anterior: null });
    expect(result[3]).toEqual({ diaRelativo: 4, actual: null, anterior: null });
    expect(result[4]).toEqual({ diaRelativo: 5, actual: null, anterior: 80.5 });
  });

  it("con varios puntos el mismo día relativo, se queda con el último (orden de entrada)", () => {
    const result = alignComparisonSeries({
      actual: {
        points: [
          { date: "2026-07-01T08:00:00.000Z", value: 100 },
          { date: "2026-07-01T20:00:00.000Z", value: 105 },
        ],
        periodStart: "2026-07-01T00:00:00.000Z",
      },
      anterior: { points: [], periodStart: "2026-06-01T00:00:00.000Z" },
    });

    expect(result).toEqual([{ diaRelativo: 1, actual: 105, anterior: null }]);
  });

  it("no conecta huecos: un valor null explícito en el punto de origen se conserva", () => {
    const result = alignComparisonSeries({
      actual: {
        points: [{ date: "2026-07-01T00:00:00.000Z", value: null }],
        periodStart: "2026-07-01T00:00:00.000Z",
      },
      anterior: { points: [], periodStart: "2026-06-01T00:00:00.000Z" },
    });

    expect(result).toEqual([{ diaRelativo: 1, actual: null, anterior: null }]);
  });
});
