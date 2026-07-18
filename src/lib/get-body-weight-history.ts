import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Mismo tipo de fecha (ISO datetime) que validate-body-weight.ts, para que
// los filtros de rango acepten exactamente el mismo formato que los
// registros que filtran.
const historyFilterSchema = z
  .object({
    desde: z.iso.datetime().optional(),
    hasta: z.iso.datetime().optional(),
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

export type BodyWeightHistoryFilter = z.input<typeof historyFilterSchema>;

export type GetBodyWeightHistoryResult =
  | {
      success: true;
      data: { id: string; weightKg: number; date: Date }[];
    }
  | { success: false; error: { code: "VALIDATION_ERROR"; message: string } };

// userId es siempre un parámetro explícito (ver DECISIONS.md), nunca se deriva
// dentro de la función de dominio, para poder reutilizarla igual desde la API
// web que desde el futuro servidor MCP.
export async function getBodyWeightHistory(
  userId: string,
  filters: unknown = {},
): Promise<GetBodyWeightHistoryResult> {
  const result = historyFilterSchema.safeParse(filters);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el rango de fechas indicado.",
      },
    };
  }

  const { desde, hasta } = result.data;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (desde) dateFilter.gte = new Date(desde);
  if (hasta) dateFilter.lte = new Date(hasta);

  const entries = await prisma.bodyWeight.findMany({
    where: {
      userId,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    orderBy: { date: "desc" },
  });

  return { success: true, data: entries };
}
