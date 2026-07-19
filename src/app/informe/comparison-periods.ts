import { z } from "zod";

export type ComparisonPreset = "mes" | "anio";

const comparisonPresetSchema = z.enum(["mes", "anio"]);

// Un valor ausente o inválido en el query param `comparar` (URL editada a
// mano, o preset que ya no existe) se ignora en vez de romper la página —
// mismo criterio que el resto de filtros de /informe (ejercicio, desde/
// hasta).
export function parseComparisonPreset(
  raw: string | undefined,
): ComparisonPreset | undefined {
  const result = comparisonPresetSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

export type PeriodRange = {
  // Límites ISO datetime completos (medianoche UTC / fin de día UTC), mismo
  // criterio que parse-date-range.ts (BL-005, ver DECISIONS.md): listos
  // para pasar directamente como filtros desde/hasta a getProgressReport.
  desde: string;
  hasta: string;
};

export type ComparisonPeriods = {
  actual: PeriodRange;
  anterior: PeriodRange;
};

function toDayStartIso(year: number, monthIndex: number, day: number): string {
  // Date.UTC normaliza automáticamente meses/días fuera de rango (p.ej.
  // month=-1 pasa a diciembre del año anterior, day=0 pasa al último día
  // del mes anterior), lo que simplifica los cálculos de "mes anterior"
  // cruzando el límite de año sin lógica especial.
  const date = new Date(Date.UTC(year, monthIndex, day));
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function toDayEndIso(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return `${date.toISOString().slice(0, 10)}T23:59:59.999Z`;
}

function toDayEndIsoFromDate(date: Date): string {
  return toDayEndIso(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

// Calcula los límites del periodo "actual" (desde el inicio del mes/año en
// curso hasta hoy — normalmente parcial) y del periodo "anterior" (el
// mes/año completo inmediatamente anterior), ambos en límites de día UTC.
// `now` es un parámetro explícito (no `new Date()` interno) para que el
// cálculo sea determinista y testeable, mismo criterio que
// computeStreakWeeks en get-progress-report.ts.
export function computeComparisonPeriods(
  preset: ComparisonPreset,
  now: Date,
): ComparisonPeriods {
  const year = now.getUTCFullYear();

  if (preset === "mes") {
    const month = now.getUTCMonth();
    return {
      actual: {
        desde: toDayStartIso(year, month, 1),
        hasta: toDayEndIsoFromDate(now),
      },
      anterior: {
        desde: toDayStartIso(year, month - 1, 1),
        // Día 0 del mes actual = último día del mes anterior.
        hasta: toDayEndIso(year, month, 0),
      },
    };
  }

  return {
    actual: {
      desde: toDayStartIso(year, 0, 1),
      hasta: toDayEndIsoFromDate(now),
    },
    anterior: {
      desde: toDayStartIso(year - 1, 0, 1),
      hasta: toDayEndIso(year - 1, 11, 31),
    },
  };
}
