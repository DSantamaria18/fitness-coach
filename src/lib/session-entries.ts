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

function buildStrengthEntries(
  ejercicios: ValidatedRegistroEjercicio[],
  exerciseByName: Map<string, { id: string }>,
) {
  return ejercicios.filter(isFuerza).map((entry, order) => ({
    exerciseId: exerciseByName.get(entry.ejercicio)!.id,
    notes: entry.notas,
    order,
    sets: {
      create: entry.series.map((serie, serieOrder) => ({
        order: serieOrder,
        reps: serie.reps,
        weightKg: serie.peso_kg,
        tempo: serie.tempo,
        rpe: serie.RPE,
      })),
    },
  }));
}

function buildCardioEntries(
  ejercicios: ValidatedRegistroEjercicio[],
  exerciseByName: Map<string, { id: string }>,
) {
  return ejercicios.filter(isCardio).map((entry) => ({
    exerciseId: exerciseByName.get(entry.ejercicio)!.id,
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
  }));
}
