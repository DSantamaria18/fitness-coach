import type { Metadata } from "next";
import { auth } from "@/auth";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";
import { getSessionHistory } from "@/lib/get-session-history";
import { toSessionHistoryEntry } from "@/lib/to-session-history-entry";
import { listExercises } from "@/lib/list-exercises";
import { WeightHistorySection } from "./weight-history-section";
import { SessionHistorySection } from "./session-history-section";

export const metadata: Metadata = {
  title: "Historial — Fitness Coach",
};

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
