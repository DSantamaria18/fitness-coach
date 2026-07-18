import { prisma } from "@/lib/prisma";
import { validateBodyWeight } from "@/lib/validate-body-weight";

export type BodyWeightMutationError =
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "NOT_FOUND"; message: string };

export type UpdateBodyWeightResult =
  | { success: true; data: { id: string; weightKg: number; date: Date } }
  | { success: false; error: BodyWeightMutationError };

// userId es siempre un parámetro explícito (ver DECISIONS.md). Se comprueba
// la pertenencia del registro con un findFirst antes de escribir: es la
// guarda de autorización a nivel de dominio, no delegable al caller, para
// que nunca se pueda editar el registro de otro usuario aunque hoy solo
// exista uno.
export async function updateBodyWeight(
  userId: string,
  id: string,
  input: unknown,
): Promise<UpdateBodyWeightResult> {
  const validation = validateBodyWeight(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el peso y la fecha introducidos.",
      },
    };
  }

  const existing = await prisma.bodyWeight.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Registro no encontrado." },
    };
  }

  const updated = await prisma.bodyWeight.update({
    where: { id },
    data: {
      weightKg: validation.data.weightKg,
      date: new Date(validation.data.date),
    },
  });

  return { success: true, data: updated };
}
