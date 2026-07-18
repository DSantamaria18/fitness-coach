import { z } from "zod";
import { bodyWeightSchema } from "@/lib/validate-body-weight";
import { sessionSchema } from "@/lib/validate-session";

// Reutiliza directamente los esquemas Zod ya cerrados y testeados de la
// capa de dominio (mismo criterio de validación que la web): la tool MCP
// no duplica reglas de negocio, solo declara la forma esperada de cada
// input para que el SDK MCP pueda anunciarla al cliente.
export const logWeightSchema = bodyWeightSchema;

export const logSessionSchema = sessionSchema;

// edit_session añade el id de la sesión a editar sobre la misma forma que
// crearla (SPEC §5: edit_session(id, cambios)).
export const editSessionSchema = sessionSchema.extend({
  id: z.string().min(1),
});

// get-body-weight-history.ts, get-session-history.ts y get-progress-report.ts
// no exportan su esquema Zod interno (solo el tipo), y ya revalidan por
// completo el filtro dentro de la propia función de dominio (incluyendo el
// refinamiento "desde <= hasta"). Estos esquemas de aquí son deliberadamente
// permisivos: solo describen la forma para el protocolo MCP, sin duplicar
// esa regla de negocio — el domain function es la única fuente de verdad.
export const weightHistoryFilterSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

export const sessionHistoryFilterSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
  ejercicio: z.string().optional(),
});

export const progressReportFilterSchema = z.object({
  ejercicio: z.string().optional(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});
