import type { Metadata } from "next";
import { auth } from "@/auth";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";
import { WeightHistorySection } from "./weight-history-section";

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

  const result = await getBodyWeightHistory(userId);
  const weightEntries = result.success
    ? result.data.map((entry) => ({
        id: entry.id,
        weightKg: entry.weightKg,
        date: entry.date.toISOString(),
      }))
    : [];

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Historial</h1>

      {/* Sección delimitada a propósito: deja hueco para añadir al lado el
          historial de sesiones de entreno sin reestructurar esta página. */}
      <WeightHistorySection entries={weightEntries} />
    </main>
  );
}
