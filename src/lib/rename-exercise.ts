import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { validateExerciseInput } from "@/lib/validate-exercise";
import type { ExerciseMutationError } from "@/lib/exercise-mutation-error";

export type RenameExerciseResult =
  | {
      success: true;
      data: { id: string; name: string; type: "STRENGTH" | "CARDIO" };
    }
  | {
      success: false;
      error: Extract<
        ExerciseMutationError,
        { code: "VALIDATION_ERROR" | "NOT_FOUND" }
      >;
    };

// Permite renombrar (nombre y/o tipo) un ejercicio ya existente del
// catálogo — decisión de producto explícita (ver DECISIONS.md): no solo
// añadir/quitar, también corregir un ejercicio mal escrito o mal tipado sin
// perder las entradas de sesión que ya lo referencian.
export async function renameExercise(
  id: string,
  input: unknown,
): Promise<RenameExerciseResult> {
  const validation = validateExerciseInput(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el nombre y el tipo de ejercicio.",
      },
    };
  }

  try {
    const exercise = await prisma.exercise.update({
      where: { id },
      data: validation.data,
    });
    return {
      success: true,
      data: { id: exercise.id, name: exercise.name, type: exercise.type },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: colisión con la constraint @unique de Exercise.name.
      if (error.code === "P2002") {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Ya existe un ejercicio con ese nombre.",
          },
        };
      }
      // P2025: el id ya no existe (p. ej. borrado desde otra pestaña justo
      // antes de guardar la edición) — no forma parte del contrato pedido
      // explícitamente, pero sin esto reventaría como 500 en un caso
      // perfectamente alcanzable desde la UI.
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
