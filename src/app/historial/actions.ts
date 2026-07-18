"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateBodyWeight } from "@/lib/update-body-weight";
import { deleteBodyWeight } from "@/lib/delete-body-weight";

export type EditWeightEntryState =
  { error: string } | { success: true } | undefined;

// El id va como primer argumento (vía .bind en el componente) para poder
// usar useActionState por fila sin perder la firma (prevState, formData)
// que espera el hook.
export async function updateWeightEntry(
  id: string,
  _prevState: EditWeightEntryState,
  formData: FormData,
): Promise<EditWeightEntryState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const weightRaw = formData.get("weight");
  const dateRaw = formData.get("date");

  const weightKg =
    typeof weightRaw === "string" ? Number.parseFloat(weightRaw) : NaN;
  const date =
    typeof dateRaw === "string" && dateRaw.length > 0
      ? new Date(`${dateRaw}T00:00:00.000Z`).toISOString()
      : "";

  // userId sale de la sesión, nunca del formulario (ver CLAUDE.md regla 7);
  // update-body-weight.ts además comprueba que el registro sea suyo.
  const result = await updateBodyWeight(userId, id, { weightKg, date });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/historial");
  return { success: true };
}

export type DeleteWeightEntryResult = { error: string } | { success: true };

export async function deleteWeightEntry(
  id: string,
): Promise<DeleteWeightEntryResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const result = await deleteBodyWeight(userId, id);
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/historial");
  return { success: true };
}
