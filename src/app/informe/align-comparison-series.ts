// Mismo shape que MetricPoint de progress-charts.tsx, definido aquí en vez
// de importado: align-comparison-series.ts es un módulo puro reutilizado
// tanto en servidor (page.tsx) como, por tipo, en cliente
// (progress-charts.tsx) — duplicar esta forma estructural pequeña evita
// cualquier dependencia entre ambos ficheros en esa dirección.
export type ComparisonMetricPoint = { date: string; value: number | null };

export type ComparisonPeriodInput = {
  points: ComparisonMetricPoint[];
  // Límite `desde` del periodo (ISO datetime), origen del día relativo 1.
  periodStart: string;
};

export type ComparisonDatasetPoint = {
  diaRelativo: number;
  actual: number | null;
  anterior: number | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function relativeDay(dateIso: string, periodStartIso: string): number {
  const diffMs =
    new Date(dateIso).getTime() - new Date(periodStartIso).getTime();
  return Math.floor(diffMs / MS_PER_DAY) + 1;
}

// Si hay más de un punto el mismo día relativo (más de una sesión el mismo
// día), se queda con el último en orden de entrada — se asume que
// `points` ya llega ordenado ascendente por fecha, como devuelve
// getProgressReport. Decisión simple documentada en DECISIONS.md: el
// último valor "gana" tal cual (incluido `null` si la sesión más reciente
// de ese día no midió el campo), sin intentar rellenar con el valor no
// nulo más reciente — caso límite improbable con un único usuario.
function toRelativeDayMap(
  points: ComparisonMetricPoint[],
  periodStartIso: string,
): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const point of points) {
    map.set(relativeDay(point.date, periodStartIso), point.value);
  }
  return map;
}

// Fusiona los puntos de dos periodos (actual/anterior) en un único dataset
// indexado por día relativo al inicio de cada periodo — no por fecha
// absoluta, para poder superponerlos en el mismo eje X (BL-006: "este mes
// vs. el anterior" tiene sentido comparando día 1 con día 1, no 1 de julio
// con 1 de junio en columnas separadas). El eje se extiende hasta el
// máximo día relativo de ambos periodos (normalmente el periodo "anterior"
// completo es más largo que el "actual", parcial hasta hoy), dejando
// huecos (`null`, sin conectar) donde un periodo no tenga dato ese día —
// mismo criterio que `connectNulls={false}` en SingleMetricChart.
export function alignComparisonSeries(params: {
  actual: ComparisonPeriodInput;
  anterior: ComparisonPeriodInput;
}): ComparisonDatasetPoint[] {
  const actualMap = toRelativeDayMap(
    params.actual.points,
    params.actual.periodStart,
  );
  const anteriorMap = toRelativeDayMap(
    params.anterior.points,
    params.anterior.periodStart,
  );

  const maxDay = Math.max(0, ...actualMap.keys(), ...anteriorMap.keys());

  const result: ComparisonDatasetPoint[] = [];
  for (let day = 1; day <= maxDay; day += 1) {
    result.push({
      diaRelativo: day,
      actual: actualMap.has(day) ? (actualMap.get(day) ?? null) : null,
      anterior: anteriorMap.has(day) ? (anteriorMap.get(day) ?? null) : null,
    });
  }
  return result;
}
