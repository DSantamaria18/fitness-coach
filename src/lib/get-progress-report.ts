import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Mismo criterio de fecha ISO opcional que get-body-weight-history.ts, más un
// filtro opcional de ejercicio (nombre del catálogo, no id: es lo que ya
// maneja la skill "sesion-entrenamiento" y el resto de la capa de dominio).
const progressReportFilterSchema = z
  .object({
    ejercicio: z.string().trim().min(1).optional(),
    desde: z.iso.datetime().optional(),
    hasta: z.iso.datetime().optional(),
  })
  .refine(
    (value) =>
      !value.desde ||
      !value.hasta ||
      new Date(value.desde) <= new Date(value.hasta),
    {
      message: "La fecha 'desde' no puede ser posterior a 'hasta'.",
      path: ["desde"],
    },
  );

export type ProgressReportFilter = z.input<typeof progressReportFilterSchema>;

export type BodyWeightEvolutionPoint = { date: Date; weightKg: number };

export type TrainingFrequency = {
  totalSessions: number;
  // Media de sesiones/semana sobre el periodo consultado (ver
  // computeTrainingFrequency para el cálculo exacto del periodo).
  sessionsPerWeek: number;
  // Ver computeStreakWeeks para el criterio exacto de "racha".
  currentStreakWeeks: number;
};

export type StrengthExerciseProgressPoint = {
  sessionId: string;
  date: Date;
  maxWeightKg: number;
  totalVolumeKg: number;
};

export type CardioExerciseProgressPoint = {
  sessionId: string;
  date: Date;
  distanceKm: number | null;
  durationSeconds: number | null;
  avgPaceSecPerKm: number | null;
};

export type ExerciseProgress =
  | {
      exercise: string;
      type: "STRENGTH";
      points: StrengthExerciseProgressPoint[];
    }
  | { exercise: string; type: "CARDIO"; points: CardioExerciseProgressPoint[] };

export type ProgressReportData = {
  bodyWeight: BodyWeightEvolutionPoint[];
  frequency: TrainingFrequency;
  // Solo presente cuando se filtra por un ejercicio concreto (SPEC.md §4,
  // caso de uso 5): la evolución de peso corporal y la frecuencia/racha son
  // siempre agregados globales, independientes de este filtro.
  exercise?: ExerciseProgress;
};

export type GetProgressReportResult =
  | { success: true; data: ProgressReportData }
  | { success: false; error: { code: "VALIDATION_ERROR"; message: string } }
  | { success: false; error: { code: "NOT_FOUND"; message: string } };

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Algoritmo estándar de semana ISO 8601 (semanas de lunes a domingo, la
// semana 1 del año es la que contiene el primer jueves). Se usa tanto para
// la racha como, indirectamente, para razonar sobre semanas en los tests.
function getIsoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jueves de esa semana

  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayNum + 3,
  );

  const weekNum =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / MS_PER_WEEK);

  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`;
}

// Racha = número de semanas ISO consecutivas, empezando por la semana actual
// y yendo hacia atrás, con al menos una sesión registrada. Se corta en
// cuanto aparece la primera semana sin sesiones (incluida la propia semana
// actual: si no hay sesión esta semana, la racha es 0 aunque hubiera
// entrenado la semana pasada).
function computeStreakWeeks(sessionDates: Date[], now: Date): number {
  const weeksWithSession = new Set(sessionDates.map(getIsoWeekKey));

  let streak = 0;
  const cursor = new Date(now);
  while (weeksWithSession.has(getIsoWeekKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return streak;
}

function computeTrainingFrequency(
  sessionDates: Date[],
  range: { desde?: string; hasta?: string },
): TrainingFrequency {
  const totalSessions = sessionDates.length;

  // El periodo sobre el que se calcula la media semanal es el rango
  // explícito filtrado si se ha indicado, o si no el propio rango cubierto
  // por las sesiones existentes (para no dividir por un periodo arbitrario
  // cuando no hay filtro de fechas).
  const periodStart = range.desde ? new Date(range.desde) : sessionDates[0];
  const periodEnd = range.hasta
    ? new Date(range.hasta)
    : sessionDates[sessionDates.length - 1];

  let sessionsPerWeek = 0;
  if (totalSessions > 0 && periodStart && periodEnd) {
    const weeksSpan = Math.max(
      1,
      Math.floor((periodEnd.getTime() - periodStart.getTime()) / MS_PER_WEEK) +
        1,
    );
    sessionsPerWeek = Math.round((totalSessions / weeksSpan) * 100) / 100;
  }

  return {
    totalSessions,
    sessionsPerWeek,
    currentStreakWeeks: computeStreakWeeks(sessionDates, new Date()),
  };
}

async function getExerciseProgress(
  exerciseName: string,
  exercise: { id: string; type: "STRENGTH" | "CARDIO" },
  userId: string,
  dateFilter: { gte?: Date; lte?: Date },
): Promise<ExerciseProgress> {
  const hasDateFilter = Object.keys(dateFilter).length > 0;
  const sessionFilter = {
    userId,
    ...(hasDateFilter ? { date: dateFilter } : {}),
  };

  if (exercise.type === "STRENGTH") {
    const entries = await prisma.strengthEntry.findMany({
      where: { exerciseId: exercise.id, session: sessionFilter },
      include: { sets: true, session: true },
      orderBy: { session: { date: "asc" } },
    });

    return {
      exercise: exerciseName,
      type: "STRENGTH",
      // Volumen total = suma de reps*peso de todas las series de ese
      // ejercicio en la sesión (SPEC.md §4). No se fusionan varias entradas
      // del mismo ejercicio en la misma sesión: cada StrengthEntry es su
      // propio punto, caso límite improbable con un único usuario.
      points: entries.map((entry) => ({
        sessionId: entry.sessionId,
        date: entry.session.date,
        // Series de ejercicios a peso corporal (Burpees, Dominadas...)
        // guardan weightKg null (ver DECISIONS.md): no aportan carga externa
        // al máximo ni al volumen, así que cuentan como 0, no como NaN.
        maxWeightKg: entry.sets.reduce(
          (max, set) => Math.max(max, set.weightKg ?? 0),
          0,
        ),
        totalVolumeKg: entry.sets.reduce(
          (sum, set) => sum + set.reps * (set.weightKg ?? 0),
          0,
        ),
      })),
    };
  }

  const entries = await prisma.cardioEntry.findMany({
    where: { exerciseId: exercise.id, session: sessionFilter },
    include: { session: true },
    orderBy: { session: { date: "asc" } },
  });

  return {
    exercise: exerciseName,
    type: "CARDIO",
    points: entries.map((entry) => ({
      sessionId: entry.sessionId,
      date: entry.session.date,
      distanceKm: entry.distanceKm,
      durationSeconds: entry.durationSeconds,
      avgPaceSecPerKm: entry.avgPaceSecPerKm,
    })),
  };
}

// userId es siempre un parámetro explícito (ver DECISIONS.md), nunca se
// deriva dentro de la función de dominio, para reutilizarla igual desde la
// API web que desde el futuro servidor MCP (get_progress_report, SPEC.md §5).
export async function getProgressReport(
  userId: string,
  filters: unknown = {},
): Promise<GetProgressReportResult> {
  const result = progressReportFilterSchema.safeParse(filters);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el ejercicio o el rango de fechas indicado.",
      },
    };
  }

  const { ejercicio, desde, hasta } = result.data;

  // La existencia del ejercicio en el catálogo es una validación contra la
  // base de datos, no de forma (igual que create-session.ts): se comprueba
  // antes de lanzar el resto de consultas para no hacer trabajo de más.
  let exercise: { id: string; type: "STRENGTH" | "CARDIO" } | null = null;
  if (ejercicio) {
    const found = await prisma.exercise.findFirst({
      where: { name: ejercicio },
    });
    if (!found) {
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `El ejercicio "${ejercicio}" no existe en el catálogo.`,
        },
      };
    }
    exercise = found;
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (desde) dateFilter.gte = new Date(desde);
  if (hasta) dateFilter.lte = new Date(hasta);
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const [bodyWeights, sessions] = await Promise.all([
    prisma.bodyWeight.findMany({
      where: { userId, ...(hasDateFilter ? { date: dateFilter } : {}) },
      // Ascendente (más antiguo primero): a diferencia del listado de
      // /historial, esto alimenta una serie temporal/gráfico, no un listado
      // de "más reciente arriba".
      orderBy: { date: "asc" },
    }),
    prisma.session.findMany({
      where: { userId, ...(hasDateFilter ? { date: dateFilter } : {}) },
      select: { date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const data: ProgressReportData = {
    bodyWeight: bodyWeights.map((entry) => ({
      date: entry.date,
      weightKg: entry.weightKg,
    })),
    // Frecuencia y racha son siempre agregados globales del usuario (no se
    // filtran por ejercicio), solo respetan el rango de fechas indicado.
    frequency: computeTrainingFrequency(
      sessions.map((session) => session.date),
      { desde, hasta },
    ),
  };

  if (exercise && ejercicio) {
    data.exercise = await getExerciseProgress(
      ejercicio,
      exercise,
      userId,
      dateFilter,
    );
  }

  return { success: true, data };
}
