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
//
// `select` explícito (sin instructionsEs/imageUrl/gifUrl, ver
// DECISIONS.md 2026-08-30): ese enriquecimiento es contenido para la UI, no
// algo que la IA necesite para elegir ejercicio — incluirlo aquí solo
// añadiría tokens de entrada de pago en cada generación de sesión sin
// aportar nada a la decisión.
export function listRecommendableExercises() {
  return prisma.exercise.findMany({
    where: { aiRecommendable: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, createdAt: true },
  });
}
