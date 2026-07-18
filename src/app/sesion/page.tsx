import type { Metadata } from "next";
import { listExercises } from "@/lib/list-exercises";
import { SessionForm } from "./session-form";

export const metadata: Metadata = {
  title: "Registrar sesión — Fitness Coach",
};

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
