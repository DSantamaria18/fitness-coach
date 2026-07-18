import { prisma } from "@/lib/prisma";

export type ProgressComment = { texto: string; generadoEn: Date };

// Lectura simple del comentario guardado (si existe), para mostrarlo al
// cargar /informe. userId es siempre un parámetro explícito (ver
// DECISIONS.md), igual que el resto de la capa de dominio.
export async function getProgressComment(
  userId: string,
): Promise<ProgressComment | null> {
  const comentario = await prisma.comentarioProgreso.findUnique({
    where: { userId },
  });

  return comentario
    ? { texto: comentario.texto, generadoEn: comentario.generadoEn }
    : null;
}
