import type { SessionHistoryEntry as DomainSessionHistoryEntry } from "@/lib/get-session-history";
import type { SessionEntryInitialData } from "@/lib/session-proposal/build-initial-registros";

export type SessionHistoryEntryDto = {
  id: string;
  date: string;
  ejercicios: SessionEntryInitialData[];
};

// Convierte una sesión tal como la devuelve Prisma (get-session-history.ts,
// campos en inglés, `null` para lo no informado) a la forma en español que
// espera SessionEntriesEditor (mismo contrato que valida validate-session.ts
// al crear/editar) — ver session-entries-editor.tsx.
//
// StrengthEntry y CardioEntry viven en tablas separadas (una sesión no puede
// guardar un único array intercalado en una base de datos relacional sin
// tablas por tipo), así que ambas comparten el mismo campo `order`
// (calculado por resolveSessionEntries sobre la posición real en la lista
// original, ver session-entries.ts). Por eso aquí se fusionan y se
// reordenan por ese campo antes de devolver la lista de `ejercicios`, en vez
// de concatenar fuerza y cardio en dos bloques — lo segundo perdería el
// orden intercalado real de la sesión (BL-004, ver DECISIONS.md 2026-07-19).
export function toSessionHistoryEntry(
  session: DomainSessionHistoryEntry,
): SessionHistoryEntryDto {
  const ejercicios = [
    ...session.strengthEntries.map((entry) => ({
      order: entry.order,
      ejercicio: {
        tipo: "fuerza" as const,
        ejercicio: entry.exercise.name,
        notas: entry.notes,
        series: entry.sets.map((set) => ({
          reps: set.reps,
          peso_kg: set.weightKg,
          tempo: set.tempo,
          RPE: set.rpe,
        })),
      },
    })),
    ...session.cardioEntries.map((entry) => ({
      order: entry.order,
      ejercicio: {
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
      },
    })),
  ]
    .sort((a, b) => a.order - b.order)
    .map(({ ejercicio }) => ejercicio);

  return {
    id: session.id,
    date: session.date.toISOString(),
    ejercicios,
  };
}
