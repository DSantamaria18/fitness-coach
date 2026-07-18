"use server";

import { auth } from "@/auth";
import { createBodyWeight } from "@/lib/create-body-weight";

export type RegisterBodyWeightState =
  { error: string } | { success: true } | undefined;

// Llama a la misma lógica compartida que /api/body-weight en vez de hacer
// un round-trip HTTP a nuestra propia API: una Server Action ya corre en
// el servidor, así que no depende de una URL base para fetch.
export async function registerBodyWeight(
  _prevState: RegisterBodyWeightState,
  formData: FormData,
): Promise<RegisterBodyWeightState> {
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

  // userId sale de la sesión, nunca del formulario (ver CLAUDE.md regla 7).
  const result = await createBodyWeight(userId, { weightKg, date });
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
