import { prisma } from "@/lib/prisma";

export type SaveProgressCommentResult =
  | { success: true; data: { texto: string; generadoEn: Date } }
  | { success: false; error: string };

// Fila única por usuario (ComentarioProgreso.userId es @unique en el
// schema): upsert para sobrescribir siempre el comentario anterior, nunca
// acumular histórico (SPEC.md §14 punto 2 / DECISIONS.md 2026-07-19).
export async function saveProgressComment(
  userId: string,
  texto: string,
): Promise<SaveProgressCommentResult> {
  const generadoEn = new Date();

  try {
    const comentario = await prisma.comentarioProgreso.upsert({
      where: { userId },
      create: { userId, texto, generadoEn },
      update: { texto, generadoEn },
    });

    return {
      success: true,
      data: { texto: comentario.texto, generadoEn: comentario.generadoEn },
    };
  } catch {
    return {
      success: false,
      error: "No se ha podido guardar el comentario de progreso.",
    };
  }
}
