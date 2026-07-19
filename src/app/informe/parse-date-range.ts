import { z } from "zod";

// Formato exacto de <input type="date">, y calendario real (rechaza p.ej.
// "2026-02-30") — más estricto que un regex de forma.
const isoDateSchema = z.iso.date();

export type DateRangeSearchParams = { desde?: string; hasta?: string };

export type ParsedDateRange = {
  // Valores validados en formato YYYY-MM-DD, listos para controlar los
  // <input type="date"> de DateRangeFilter ("" si están ausentes o son
  // inválidos, igual que ExerciseSelector vuelve a "" cuando el filtro no
  // aplica).
  raw: { desde: string; hasta: string };
  // Límites ISO datetime completos para pasar a getProgressReport (que ya
  // valida con z.iso.datetime()). Medianoche UTC para `desde`, último
  // instante del día en UTC para `hasta` — mismo criterio que el resto de
  // la app para convertir un <input type="date"> (peso/actions.ts,
  // sesion/actions.ts, historial/actions.ts: "T00:00:00.000Z"), ver
  // DECISIONS.md sobre por qué UTC fijo en vez de la zona horaria del
  // proceso.
  filters: { desde?: string; hasta?: string };
};

// Convierte los searchParams crudos de /informe (strings sin validar, en
// principio "YYYY-MM-DD" desde DateRangeFilter, pero potencialmente
// cualquier cosa si se edita la URL a mano) a límites de día usables. Un
// valor con formato inválido o una fecha de calendario inexistente se
// ignora en vez de romper la página o propagar basura a getProgressReport
// — mismo criterio que ya aplica el filtro de `ejercicio` en informe/page.tsx
// para un ejercicio que ya no existe en el catálogo.
export function parseDateRangeSearchParams(
  params: DateRangeSearchParams,
): ParsedDateRange {
  const desdeResult = isoDateSchema.safeParse(params.desde);
  const hastaResult = isoDateSchema.safeParse(params.hasta);

  const desde = desdeResult.success ? desdeResult.data : undefined;
  const hasta = hastaResult.success ? hastaResult.data : undefined;

  return {
    raw: { desde: desde ?? "", hasta: hasta ?? "" },
    filters: {
      ...(desde ? { desde: `${desde}T00:00:00.000Z` } : {}),
      ...(hasta ? { hasta: `${hasta}T23:59:59.999Z` } : {}),
    },
  };
}
