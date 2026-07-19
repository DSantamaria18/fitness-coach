"use server";

import { auth } from "@/auth";
import { createSession } from "@/lib/create-session";
import { generateSessionProposal } from "@/lib/session-proposal/generate-session-proposal";
import {
  buildInitialRegistros,
  type RegistroState,
} from "@/lib/session-proposal/build-initial-registros";

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

export type GenerateSessionProposalState =
  | { success: true; fecha: string; registros: RegistroState[] }
  | { success: false; message: string };

// Botón "Generar propuesta con IA" (SPEC §14 punto 1): invoca la skill real
// vía generateSessionProposal(userId), userId siempre desde la sesión
// autenticada (nunca del cliente, mismo criterio que registerSession de
// arriba). En éxito, reutiliza buildInitialRegistros — el mismo conversor
// que ya usa /historial para prellenar SessionEntriesEditor con una sesión
// guardada — para no duplicar esa lógica: la forma de ValidatedSession.
// ejercicios es estructuralmente compatible con SessionEntryInitialData. En
// cualquier fallo (timeout, red, salida inválida) se devuelve un aviso
// discreto y el formulario manual sigue disponible tal cual — nunca rompe el
// flujo existente.
export async function generateSessionProposalAction(): Promise<GenerateSessionProposalState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, message: "No autenticado." };
  }

  const result = await generateSessionProposal(userId);
  if (!result.success) {
    return {
      success: false,
      message:
        "No se pudo generar la propuesta con IA. Puedes registrar la sesión manualmente.",
    };
  }

  return {
    success: true,
    fecha: result.data.fecha.slice(0, 10),
    registros: buildInitialRegistros(result.data.ejercicios),
  };
}
