import type { Metadata } from "next";
import { listExercises } from "@/lib/list-exercises";
import { SessionForm } from "./session-form";

export const metadata: Metadata = {
  title: "Registrar sesión — Fitness Coach",
};

// Ruta protegida por src/proxy.ts: nunca debe servirse como página estática
// generada en build time (Next intentaría prerenderizarla y fallaría al
// llamar a la base de datos sin conexión disponible en ese momento).
export const dynamic = "force-dynamic";

export default async function SesionPage() {
  const exercises = await listExercises();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Registrar sesión</h1>
      <SessionForm
        exercises={exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
        }))}
      />
    </main>
  );
}
