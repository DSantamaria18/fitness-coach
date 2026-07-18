import { prisma } from "@/lib/prisma";
import type { SessionMutationError } from "@/lib/update-session";

export type DeleteSessionResult =
  | { success: true }
  | {
      success: false;
      error: Extract<SessionMutationError, { code: "NOT_FOUND" }>;
    };

// Mismo patrón de guarda de pertenencia que delete-body-weight.ts: nunca se
// borra sin comprobar antes que la sesión es del userId dado.
//
// A diferencia de update-session.ts (que sustituye entradas y por eso hace
// deleteMany explícito dentro de una transacción), aquí basta con
// prisma.session.delete: el esquema declara `onDelete: Cascade` en
// StrengthEntry/CardioEntry hacia Session (y StrengthSet hacia
// StrengthEntry), y se comprobó empíricamente contra el adapter
// @prisma/adapter-better-sqlite3 (no solo leyendo schema.prisma) que esas
// cascadas se aplican en runtime, sin dejar registros huérfanos — ver
// DECISIONS.md.
export async function deleteSession(
  userId: string,
  id: string,
): Promise<DeleteSessionResult> {
  const existing = await prisma.session.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Sesión no encontrada." },
    };
  }

  await prisma.session.delete({ where: { id } });

  return { success: true };
}
