import { prisma } from "@/lib/prisma";
import type { BodyWeightMutationError } from "@/lib/update-body-weight";

export type DeleteBodyWeightResult =
  | { success: true }
  | {
      success: false;
      error: Extract<BodyWeightMutationError, { code: "NOT_FOUND" }>;
    };

// Mismo patrón de guarda de pertenencia que update-body-weight.ts: nunca se
// borra sin comprobar antes que el registro es del userId dado.
export async function deleteBodyWeight(
  userId: string,
  id: string,
): Promise<DeleteBodyWeightResult> {
  const existing = await prisma.bodyWeight.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Registro no encontrado." },
    };
  }

  await prisma.bodyWeight.delete({ where: { id } });

  return { success: true };
}
