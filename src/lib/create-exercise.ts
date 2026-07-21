import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { validateExerciseInput } from "@/lib/validate-exercise";
import type { ExerciseMutationError } from "@/lib/exercise-mutation-error";

export type CreateExerciseResult =
  | {
      success: true;
      data: { id: string; name: string; type: "STRENGTH" | "CARDIO" };
    }
  | {
      success: false;
      error: Extract<ExerciseMutationError, { code: "VALIDATION_ERROR" }>;
    };

// Catálogo global, sin userId (ver list-exercises.ts): gestionable desde
// /ajustes, ya no es un catálogo cerrado sembrado solo por prisma/seed.ts
// (ver schema.prisma y FEATURES.md). La comprobación de auth vive en la
// Server Action que envuelve esta función (src/app/ajustes/actions.ts), no
// aquí, igual que list-exercises.ts no la necesita.
export async function createExercise(
  input: unknown,
): Promise<CreateExerciseResult> {
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
    const exercise = await prisma.exercise.create({ data: validation.data });
    return {
      success: true,
      data: { id: exercise.id, name: exercise.name, type: exercise.type },
    };
  } catch (error) {
    // P2002: colisión con la constraint @unique de Exercise.name — se
    // traduce a un mensaje que el usuario puede entender y actuar, en vez de
    // dejarlo reventar como un 500 sin explicación.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Ya existe un ejercicio con ese nombre.",
        },
      };
    }
    throw error;
  }
}
