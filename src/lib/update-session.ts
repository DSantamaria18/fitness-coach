import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/validate-session";
import { resolveSessionEntries } from "@/lib/session-entries";

export type SessionMutationError =
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "NOT_FOUND"; message: string };

export type UpdateSessionResult =
  | { success: true; data: { id: string; date: Date } }
  | { success: false; error: SessionMutationError };

// userId es siempre un parámetro explícito (ver DECISIONS.md). Se comprueba
// la pertenencia de la sesión con un findFirst antes de escribir — misma
// guarda de autorización a nivel de dominio que update-body-weight.ts.
export async function updateSession(
  userId: string,
  id: string,
  input: unknown,
): Promise<UpdateSessionResult> {
  const validation = validateSession(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los ejercicios y la fecha introducidos.",
      },
    };
  }

  const existing = await prisma.session.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Sesión no encontrada." },
    };
  }

  const { fecha, ejercicios } = validation.data;

  // Misma validación de catálogo (existencia + tipo) y construcción de datos
  // de creación anidada que create-session.ts, vía el helper compartido.
  const resolved = await resolveSessionEntries(ejercicios);
  if (!resolved.success) {
    return { success: false, error: resolved.error };
  }

  const { strengthEntries, cardioEntries } = resolved.data;

  // Se sustituyen por completo las entradas de la sesión: se borran las
  // existentes y se crean las nuevas dentro de la misma transacción, para
  // que la sesión nunca quede en un estado a medias si falla algo a mitad
  // (mismo motivo que la transacción de create-session.ts).
  const session = await prisma.$transaction(async (tx) => {
    await tx.strengthEntry.deleteMany({ where: { sessionId: id } });
    await tx.cardioEntry.deleteMany({ where: { sessionId: id } });

    return tx.session.update({
      where: { id },
      data: {
        date: new Date(fecha),
        strengthEntries: strengthEntries.length
          ? { create: strengthEntries }
          : undefined,
        cardioEntries: cardioEntries.length
          ? { create: cardioEntries }
          : undefined,
      },
    });
  });

  return { success: true, data: { id: session.id, date: session.date } };
}
