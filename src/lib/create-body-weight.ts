import { prisma } from "@/lib/prisma";
import { validateBodyWeight } from "@/lib/validate-body-weight";

export type CreateBodyWeightResult =
  | { success: true; data: { id: string; weightKg: number; date: Date } }
  | { success: false; error: string };

// Compartido entre la ruta API (/api/body-weight) y la Server Action del
// formulario /peso para no duplicar la validación ni la escritura a Prisma.
export async function createBodyWeight(
  userId: string,
  input: unknown,
): Promise<CreateBodyWeightResult> {
  const result = validateBodyWeight(input);
  if (!result.success) {
    return { success: false, error: "Revisa el peso y la fecha introducidos." };
  }

  const bodyWeight = await prisma.bodyWeight.create({
    data: {
      userId,
      weightKg: result.data.weightKg,
      date: new Date(result.data.date),
    },
  });

  return { success: true, data: bodyWeight };
}
