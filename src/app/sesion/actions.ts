"use server";

import { auth } from "@/auth";
import { createSession } from "@/lib/create-session";

export type RegisterSessionState =
  { error: string } | { success: true } | undefined;

// Llama a la misma lógica compartida que /api/sessions en vez de hacer un
// round-trip HTTP a nuestra propia API (mismo patrón que peso/actions.ts).
export async function registerSession(
  _prevState: RegisterSessionState,
  formData: FormData,
): Promise<RegisterSessionState> {
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

  // El formulario serializa los ejercicios como JSON en un input oculto
  // (no son representables como pares clave/valor planos de FormData): ver
  // session-form.tsx.
  const ejerciciosRaw = formData.get("ejercicios");
  let ejercicios: unknown = [];
  if (typeof ejerciciosRaw === "string") {
    try {
      ejercicios = JSON.parse(ejerciciosRaw);
    } catch {
      return { error: "No se pudieron leer los ejercicios del formulario." };
    }
  }

  // userId sale de la sesión, nunca del formulario (ver CLAUDE.md regla 7).
  const result = await createSession(userId, { fecha, ejercicios });
  if (!result.success) {
    return { error: result.error };
  }

  return { success: true };
}
