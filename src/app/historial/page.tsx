import type { Metadata } from "next";
import { auth } from "@/auth";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";
import {
  getSessionHistory,
  type SessionHistoryEntry as DomainSessionHistoryEntry,
} from "@/lib/get-session-history";
import { listExercises } from "@/lib/list-exercises";
import { WeightHistorySection } from "./weight-history-section";
import {
  SessionHistorySection,
  type SessionHistoryEntry,
} from "./session-history-section";

export const metadata: Metadata = {
  title: "Historial — Fitness Coach",
};

// Convierte una sesión tal como la devuelve Prisma (get-session-history.ts,
// campos en inglés, `null` para lo no informado) a la forma en español que
// espera SessionEntriesEditor (mismo contrato que valida validate-session.ts
// al crear/editar) — ver session-entries-editor.tsx.
function toSessionHistoryEntry(
  session: DomainSessionHistoryEntry,
): SessionHistoryEntry {
  return {
    id: session.id,
    date: session.date.toISOString(),
    ejercicios: [
      ...session.strengthEntries.map((entry) => ({
        tipo: "fuerza" as const,
        ejercicio: entry.exercise.name,
        notas: entry.notes,
        series: entry.sets.map((set) => ({
          reps: set.reps,
          peso_kg: set.weightKg,
          tempo: set.tempo,
          RPE: set.rpe,
        })),
      })),
      ...session.cardioEntries.map((entry) => ({
        tipo: "cardio" as const,
        ejercicio: entry.exercise.name,
        notas: entry.notes,
        duracion: entry.durationSeconds,
        distancia_km: entry.distanceKm,
        velocidad_media: entry.avgSpeedKmh,
        ritmo_medio: entry.avgPaceSecPerKm,
        frecuencia_cardiaca_media: entry.avgHeartRate,
        frecuencia_cardiaca_maxima: entry.maxHeartRate,
        pasos: entry.steps,
        frecuencia_paso: entry.stepFrequency,
        kcal: entry.kcal,
        RPE: entry.rpe,
      })),
    ],
  };
}

export default async function HistorialPage() {
  // Server Component: puede llamar a la capa de dominio directamente, sin
  // pasar por la API HTTP (mismo patrón que /peso, ver DECISIONS.md).
  // src/proxy.ts ya exige sesión para llegar aquí, pero se comprueba de
  // nuevo porque la capa de dominio nunca debe asumir un userId no nulo.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const [weightResult, sessionResult, exercises] = await Promise.all([
    getBodyWeightHistory(userId),
    getSessionHistory(userId),
    listExercises(),
  ]);

  const weightEntries = weightResult.success
    ? weightResult.data.map((entry) => ({
        id: entry.id,
        weightKg: entry.weightKg,
        date: entry.date.toISOString(),
      }))
    : [];

  const sessionEntries = sessionResult.success
    ? sessionResult.data.map(toSessionHistoryEntry)
    : [];

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Historial</h1>

      <WeightHistorySection entries={weightEntries} />

      <SessionHistorySection
        entries={sessionEntries}
        exercises={exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
        }))}
      />
    </main>
  );
}
