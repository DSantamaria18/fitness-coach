import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ExerciseMutationError } from "@/lib/exercise-mutation-error";

export type DeleteExerciseResult =
  | { success: true }
  | {
      success: false;
      error: Extract<ExerciseMutationError, { code: "NOT_FOUND" | "IN_USE" }>;
    };

// Borrado real, no soft-delete (decisión de producto explícita, ver
// DECISIONS.md). El esquema NO declara onDelete: Cascade en
// StrengthEntry/CardioEntry hacia Exercise a propósito: si el ejercicio ya
// tiene entradas de sesión asociadas, la FK constraint de SQLite bloquea el
// borrado y Prisma lo traduce en P2003, que aquí se captura para devolver
// un mensaje claro al usuario en vez de dejarlo reventar como un 500.
export async function deleteExercise(
  id: string,
): Promise<DeleteExerciseResult> {
  try {
    await prisma.exercise.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return {
          success: false,
          error: {
            code: "IN_USE",
            message: "No se puede eliminar: ya tiene sesiones registradas.",
          },
        };
      }
      // P2025: el id ya no existe (p. ej. doble clic en Borrar, o borrado
      // desde otra pestaña) — mismo motivo que en rename-exercise.ts.
      if (error.code === "P2025") {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Ejercicio no encontrado." },
        };
      }
    }
    throw error;
  }
}
