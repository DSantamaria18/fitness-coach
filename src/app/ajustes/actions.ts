"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createExercise } from "@/lib/create-exercise";
import { renameExercise } from "@/lib/rename-exercise";
import { deleteExercise } from "@/lib/delete-exercise";

// El catálogo de ejercicios es global (sin userId, ver list-exercises.ts),
// pero la Server Action sigue exigiendo sesión autenticada — misma guarda
// que el resto de mutaciones de la app (ver historial/actions.ts), aunque
// aquí userId no se propague a la capa de dominio.
export type CreateExerciseState =
  { error: string } | { success: true } | undefined;

export async function createExerciseAction(
  _prevState: CreateExerciseState,
  formData: FormData,
): Promise<CreateExerciseState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const result = await createExercise({
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!result.success) {
    return { error: result.error.message };
  }

  // El desplegable de "añadir ejercicio" de /sesion lee del mismo catálogo
  // y debe refrescarse en cuanto cambia desde /ajustes.
  revalidatePath("/ajustes");
  revalidatePath("/sesion");
  return { success: true };
}

export type RenameExerciseState =
  { error: string } | { success: true } | undefined;

// El id va como primer argumento (vía .bind en el componente) para poder
// usar useActionState por fila sin perder la firma (prevState, formData)
// que espera el hook — mismo patrón que updateWeightEntry/updateSessionEntry
// en historial/actions.ts.
export async function renameExerciseAction(
  id: string,
  _prevState: RenameExerciseState,
  formData: FormData,
): Promise<RenameExerciseState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const result = await renameExercise(id, {
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/ajustes");
  revalidatePath("/sesion");
  return { success: true };
}

export type DeleteExerciseActionResult = { error: string } | { success: true };

export async function deleteExerciseAction(
  id: string,
): Promise<DeleteExerciseActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const result = await deleteExercise(id);
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/ajustes");
  revalidatePath("/sesion");
  return { success: true };
}
