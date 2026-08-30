import { prisma } from "@/lib/prisma";

// Extraído a su propio lib (en vez de vivir directamente en /sesion/page.tsx)
// para poder testear la consulta sin renderizar el Server Component.
export function listExercises() {
  return prisma.exercise.findMany({ orderBy: { name: "asc" } });
}

// Subconjunto del catálogo que la IA puede proponer al generar una sesión
// (createListExercisesTool, ver session-proposal/tools.ts). Ejercicios con
// aiRecommendable: false (cardio espontáneo: surf, salida al monte...) siguen
// siendo válidos para el registro manual vía listExercises(), solo quedan
// fuera de lo que la IA puede elegir.
export function listRecommendableExercises() {
  return prisma.exercise.findMany({
    where: { aiRecommendable: true },
    orderBy: { name: "asc" },
  });
}
