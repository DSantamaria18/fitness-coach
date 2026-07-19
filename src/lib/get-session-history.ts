import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Mismo patrón de filtro de rango que get-body-weight-history.ts, con un
// filtro adicional opcional por nombre de ejercicio (SPEC §4 caso de uso 4).
const historyFilterSchema = z
  .object({
    desde: z.iso.datetime().optional(),
    hasta: z.iso.datetime().optional(),
    ejercicio: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      !value.desde ||
      !value.hasta ||
      new Date(value.desde) <= new Date(value.hasta),
    {
      message: "La fecha 'desde' no puede ser posterior a 'hasta'.",
      path: ["desde"],
    },
  );

export type SessionHistoryFilter = z.input<typeof historyFilterSchema>;

// Incluye las entradas de fuerza (con sus series, en orden) y de cardio,
// cada una con el nombre de su ejercicio, para poder mostrar una sesión
// completa sin consultas adicionales. Se ordenan por `order` para respetar
// el orden en que se registraron los ejercicios/series dentro de la sesión.
const sessionInclude = {
  strengthEntries: {
    include: { exercise: true, sets: { orderBy: { order: "asc" as const } } },
    orderBy: { order: "asc" as const },
  },
  cardioEntries: {
    include: { exercise: true },
    orderBy: { order: "asc" as const },
  },
} satisfies Prisma.SessionInclude;

export type SessionHistoryEntry = Prisma.SessionGetPayload<{
  include: typeof sessionInclude;
}>;

export type GetSessionHistoryResult =
  | { success: true; data: SessionHistoryEntry[] }
  | { success: false; error: { code: "VALIDATION_ERROR"; message: string } };

// userId es siempre un parámetro explícito (ver DECISIONS.md), nunca se deriva
// dentro de la función de dominio, para poder reutilizarla igual desde la API
// web que desde el futuro servidor MCP.
export async function getSessionHistory(
  userId: string,
  filters: unknown = {},
): Promise<GetSessionHistoryResult> {
  const result = historyFilterSchema.safeParse(filters);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el rango de fechas o el ejercicio indicados.",
      },
    };
  }

  const { desde, hasta, ejercicio } = result.data;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (desde) dateFilter.gte = new Date(desde);
  if (hasta) dateFilter.lte = new Date(hasta);

  // Una sesión "contiene" el ejercicio si aparece en cualquiera de sus
  // entradas de fuerza o de cardio (SPEC §4 caso de uso 4): se filtra a
  // nivel de sesión, no de entrada — la sesión completa se devuelve igual.
  const exerciseFilter = ejercicio
    ? {
        OR: [
          { strengthEntries: { some: { exercise: { name: ejercicio } } } },
          { cardioEntries: { some: { exercise: { name: ejercicio } } } },
        ],
      }
    : {};

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      ...exerciseFilter,
    },
    include: sessionInclude,
    orderBy: { date: "desc" },
  });

  return { success: true, data: sessions };
}
