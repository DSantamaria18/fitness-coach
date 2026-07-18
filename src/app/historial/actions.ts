"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { updateBodyWeight } from "@/lib/update-body-weight";
import { deleteBodyWeight } from "@/lib/delete-body-weight";
import { updateSession } from "@/lib/update-session";
import { deleteSession } from "@/lib/delete-session";

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

export type EditSessionEntryState =
  { error: string } | { success: true } | undefined;

// Mismo patrón de parseo que sesion/actions.ts: el id va primero (vía .bind
// en el componente) para poder usar useActionState por fila, y los
// ejercicios llegan como JSON en un input oculto (ver SessionEntriesEditor).
export async function updateSessionEntry(
  id: string,
  _prevState: EditSessionEntryState,
  formData: FormData,
): Promise<EditSessionEntryState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const fechaRaw = formData.get("fecha");
  const fecha =
    typeof fechaRaw === "string" && fechaRaw.length > 0
      ? new Date(`${fechaRaw}T00:00:00.000Z`).toISOString()
      : "";

  const ejerciciosRaw = formData.get("ejercicios");
  let ejercicios: unknown = [];
  if (typeof ejerciciosRaw === "string") {
    try {
      ejercicios = JSON.parse(ejerciciosRaw);
    } catch {
      return { error: "No se pudieron leer los ejercicios del formulario." };
    }
  }

  // userId sale de la sesión, nunca del formulario (ver CLAUDE.md regla 7);
  // update-session.ts además comprueba que la sesión sea suya.
  const result = await updateSession(userId, id, { fecha, ejercicios });
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/historial");
  return { success: true };
}

export type DeleteSessionEntryResult = { error: string } | { success: true };

export async function deleteSessionEntry(
  id: string,
): Promise<DeleteSessionEntryResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const result = await deleteSession(userId, id);
  if (!result.success) {
    return { error: result.error.message };
  }

  revalidatePath("/historial");
  return { success: true };
}
