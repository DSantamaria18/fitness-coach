import { prisma } from "@/lib/prisma";
import {
  validateSession,
  type ValidatedRegistroEjercicio,
} from "@/lib/validate-session";

export type CreateSessionResult =
  | { success: true; data: { id: string; date: Date } }
  | { success: false; error: string };

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

// Compartido entre la ruta API (/api/sessions) y la Server Action del
// formulario /sesion para no duplicar la validación ni la escritura a
// Prisma, igual que create-body-weight.ts.
export async function createSession(
  userId: string,
  input: unknown,
): Promise<CreateSessionResult> {
  const result = validateSession(input);
  if (!result.success) {
    return {
      success: false,
      error: "Revisa los ejercicios y la fecha introducidos.",
    };
  }

  const { fecha, ejercicios } = result.data;

  // La existencia del ejercicio en el catálogo (y que su tipo coincida con
  // fuerza/cardio) es una validación de existencia contra la base de datos,
  // no de forma: por eso vive aquí y no en el Zod puro de validate-session.ts.
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
        error: `El ejercicio "${entry.ejercicio}" no existe en el catálogo.`,
      };
    }
    const expectedType = entry.tipo === "fuerza" ? "STRENGTH" : "CARDIO";
    if (exercise.type !== expectedType) {
      return {
        success: false,
        error: `El ejercicio "${entry.ejercicio}" no es de tipo ${entry.tipo}.`,
      };
    }
  }

  const strengthEntries = ejercicios.filter(isFuerza).map((entry, order) => ({
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

  const cardioEntries = ejercicios.filter(isCardio).map((entry) => ({
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

  // Transacción explícita: si falla la creación de cualquier registro de
  // ejercicio a mitad de la escritura, no debe quedar una Session huérfana.
  const session = await prisma.$transaction(async (tx) => {
    return tx.session.create({
      data: {
        userId,
        date: new Date(fecha),
        strengthEntries: strengthEntries.length
          ? { create: strengthEntries }
          : undefined,
        cardioEntries: cardioEntries.length
          ? { create: cardioEntries }
          : undefined,
      },
    });
  });

  return { success: true, data: { id: session.id, date: session.date } };
}
