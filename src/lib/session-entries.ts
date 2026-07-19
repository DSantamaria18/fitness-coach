import { prisma } from "@/lib/prisma";
import type { ValidatedRegistroEjercicio } from "@/lib/validate-session";

export type SessionEntriesError = {
  code: "VALIDATION_ERROR";
  message: string;
};

function isFuerza(
  entry: ValidatedRegistroEjercicio,
): entry is Extract<ValidatedRegistroEjercicio, { tipo: "fuerza" }> {
  return entry.tipo === "fuerza";
}

function isCardio(
  entry: ValidatedRegistroEjercicio,
): entry is Extract<ValidatedRegistroEjercicio, { tipo: "cardio" }> {
  return entry.tipo === "cardio";
}

// Comprueba la existencia de cada ejercicio en el catálogo (y que su tipo
// coincida con fuerza/cardio, contra la base de datos, no en Zod) y
// construye los datos de creación anidada de StrengthEntry/CardioEntry a
// partir de los ejercicios ya validados por Zod. Extraído de create-session.ts
// porque update-session.ts necesita exactamente la misma lógica para
// sustituir las entradas de una sesión existente.
export async function resolveSessionEntries(
  ejercicios: ValidatedRegistroEjercicio[],
): Promise<
  | {
      success: true;
      data: {
        strengthEntries: ReturnType<typeof buildStrengthEntries>;
        cardioEntries: ReturnType<typeof buildCardioEntries>;
      };
    }
  | { success: false; error: SessionEntriesError }
> {
  const exerciseNames = [
    ...new Set(ejercicios.map((entry) => entry.ejercicio)),
  ];
  const exercises = await prisma.exercise.findMany({
    where: { name: { in: exerciseNames } },
  });
  const exerciseByName = new Map(
    exercises.map((exercise) => [exercise.name, exercise]),
  );

  for (const entry of ejercicios) {
    const exercise = exerciseByName.get(entry.ejercicio);
    if (!exercise) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `El ejercicio "${entry.ejercicio}" no existe en el catálogo.`,
        },
      };
    }
    const expectedType = entry.tipo === "fuerza" ? "STRENGTH" : "CARDIO";
    if (exercise.type !== expectedType) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `El ejercicio "${entry.ejercicio}" no es de tipo ${entry.tipo}.`,
        },
      };
    }
  }

  return {
    success: true,
    data: {
      strengthEntries: buildStrengthEntries(ejercicios, exerciseByName),
      cardioEntries: buildCardioEntries(ejercicios, exerciseByName),
    },
  };
}

// `order` se calcula sobre el índice en el array `ejercicios` ORIGINAL (antes
// de filtrar por tipo), no sobre el índice del subarray ya filtrado — de lo
// contrario, StrengthEntry/CardioEntry (dos tablas separadas) perderían la
// posición relativa real de una sesión que intercala fuerza y cardio (p. ej.
// cardio-fuerza-cardio) al reconstruirse en /historial (BL-004, ver
// DECISIONS.md 2026-07-19 y ARCHITECTURE.md).
function buildStrengthEntries(
  ejercicios: ValidatedRegistroEjercicio[],
  exerciseByName: Map<string, { id: string }>,
) {
  const entries: {
    exerciseId: string;
    notes: string | undefined;
    order: number;
    sets: { create: ReturnType<typeof buildSets> };
  }[] = [];

  ejercicios.forEach((entry, order) => {
    if (!isFuerza(entry)) return;
    entries.push({
      exerciseId: exerciseByName.get(entry.ejercicio)!.id,
      notes: entry.notas,
      order,
      sets: { create: buildSets(entry.series) },
    });
  });

  return entries;
}

function buildSets(
  series: Extract<ValidatedRegistroEjercicio, { tipo: "fuerza" }>["series"],
) {
  return series.map((serie, serieOrder) => ({
    order: serieOrder,
    reps: serie.reps,
    weightKg: serie.peso_kg,
    tempo: serie.tempo,
    rpe: serie.RPE,
  }));
}

function buildCardioEntries(
  ejercicios: ValidatedRegistroEjercicio[],
  exerciseByName: Map<string, { id: string }>,
) {
  const entries: {
    exerciseId: string;
    order: number;
    durationSeconds: number | undefined;
    distanceKm: number | undefined;
    avgSpeedKmh: number | undefined;
    avgPaceSecPerKm: number | undefined;
    avgHeartRate: number | undefined;
    maxHeartRate: number | undefined;
    steps: number | undefined;
    stepFrequency: number | undefined;
    kcal: number | undefined;
    rpe: number | undefined;
    notes: string | undefined;
  }[] = [];

  ejercicios.forEach((entry, order) => {
    if (!isCardio(entry)) return;
    entries.push({
      exerciseId: exerciseByName.get(entry.ejercicio)!.id,
      order,
      durationSeconds: entry.duracion,
      distanceKm: entry.distancia_km,
      avgSpeedKmh: entry.velocidad_media,
      avgPaceSecPerKm: entry.ritmo_medio,
      avgHeartRate: entry.frecuencia_cardiaca_media,
      maxHeartRate: entry.frecuencia_cardiaca_maxima,
      steps: entry.pasos,
      stepFrequency: entry.frecuencia_paso,
      kcal: entry.kcal,
      rpe: entry.RPE,
      notes: entry.notas,
    });
  });

  return entries;
}
