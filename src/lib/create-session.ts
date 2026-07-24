import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/validate-session";
import { resolveSessionEntries } from "@/lib/session-entries";

export type CreateSessionResult =
  | { success: true; data: { id: string; date: Date } }
  | { success: false; error: string };

// Compartido entre la ruta API (/api/sessions) y la Server Action del
// formulario /sesion para no duplicar la validación ni la escritura a
// Prisma, igual que create-body-weight.ts.
export async function createSession(
  userId: string,
  input: unknown,
): Promise<CreateSessionResult> {
  const result = validateSession(input);
  if (!result.success) {
    // Sin esto, un fallo de validación no dejaba ningún rastro (ver
    // DECISIONS.md): `issues` es lo único que identifica qué campo falló y
    // por qué sin reproducir la llamada real. Mismo estilo que
    // generate-session-proposal.ts.
    console.error(
      "[createSession] VALIDATION_ERROR: el input no pasó validateSession.",
      { code: "VALIDATION_ERROR", issues: result.error.issues },
    );
    return {
      success: false,
      error: "Revisa los ejercicios y la fecha introducidos.",
    };
  }

  const { fecha, ejercicios } = result.data;

  // La existencia del ejercicio en el catálogo (y que su tipo coincida con
  // fuerza/cardio) y la construcción de los datos de creación anidada viven
  // en session-entries.ts, compartido con update-session.ts.
  const resolved = await resolveSessionEntries(ejercicios);
  if (!resolved.success) {
    return { success: false, error: resolved.error.message };
  }

  const { strengthEntries, cardioEntries } = resolved.data;

  // Transacción explícita: si falla la creación de cualquier registro de
  // ejercicio a mitad de la escritura, no debe quedar una Session huérfana.
  const session = await prisma.$transaction(async (tx) => {
    return tx.session.create({
      data: {
        userId,
        date: new Date(fecha),
        strengthEntries: strengthEntries.length
          ? { create: strengthEntries }
          : undefined,
        cardioEntries: cardioEntries.length
          ? { create: cardioEntries }
          : undefined,
      },
    });
  });

  return { success: true, data: { id: session.id, date: session.date } };
}
