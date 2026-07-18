import { prisma } from "@/lib/prisma";

// Extraído a su propio lib (en vez de vivir directamente en /sesion/page.tsx)
// para poder testear la consulta sin renderizar el Server Component.
export function listExercises() {
  return prisma.exercise.findMany({ orderBy: { name: "asc" } });
}
