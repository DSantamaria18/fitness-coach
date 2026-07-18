import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getSessionHistory } from "@/lib/get-session-history";
import { listExercises } from "@/lib/list-exercises";
import { sessionSchema } from "@/lib/validate-session";

export const SUBMIT_SESSION_PROPOSAL_TOOL_NAME = "submit_session_proposal";

// userId nunca es un campo del input_schema que el modelo pueda rellenar:
// se cierra sobre el closure de cada tool en el momento de construirla,
// igual que resolve-user.ts en el servidor MCP (ver DECISIONS.md). Aunque el
// modelo intentara colar un `userId` en el input de la tool call, el schema
// no lo declara y el `run` de abajo nunca lo lee — siempre usa el argumento
// explícito de esta factory.
export function createGetSessionHistoryTool(userId: string) {
  return betaZodTool({
    name: "get_session_history",
    description:
      "Consulta el historial real de sesiones de entreno ya registradas, opcionalmente " +
      "filtrado por rango de fechas o por nombre de ejercicio. Úsala para decidir qué tipo " +
      "de sesión toca según la rotación (Fuerza 1 → Cardio → Fuerza 2 → Activo) y para " +
      "ajustar el peso propuesto según el RPE de sesiones anteriores, tal y como indica la skill.",
    inputSchema: z.object({
      desde: z
        .string()
        .optional()
        .describe("Fecha ISO 8601 desde la que filtrar (inclusive)."),
      hasta: z
        .string()
        .optional()
        .describe("Fecha ISO 8601 hasta la que filtrar (inclusive)."),
      ejercicio: z
        .string()
        .optional()
        .describe("Nombre exacto de un ejercicio del catálogo para filtrar."),
    }),
    run: async (args) => {
      const result = await getSessionHistory(userId, args);
      if (!result.success) {
        return JSON.stringify({ error: result.error });
      }
      return JSON.stringify(result.data);
    },
  });
}

export function createListExercisesTool() {
  return betaZodTool({
    name: "list_exercises",
    description:
      "Lista el catálogo cerrado de ejercicios disponibles (fuerza y cardio) entre los que " +
      "elegir para la sesión. Los nombres devueltos son los únicos válidos para el campo " +
      "`ejercicio` de la propuesta final.",
    inputSchema: z.object({}),
    run: async () => {
      const exercises = await listExercises();
      return JSON.stringify(exercises);
    },
  });
}

// Mecanismo de salida estructurada, no una acción de dominio: se reutiliza
// literalmente `sessionSchema` (el mismo contrato que valida el registro
// manual, ver validate-session.ts) como input_schema, en vez de redefinir un
// esquema "equivalente" a mano — evita que ambos se desincronicen con el
// tiempo (mismo criterio que src/lib/mcp/schemas.ts). Este tool nunca se deja
// ejecutar en un bucle multi-turno: se fuerza con `tool_choice` en un único
// turno final (ver generate-session-proposal.ts) y su `input` se lee y valida
// directamente — el `run` de aquí solo existe para satisfacer el contrato de
// `betaZodTool` y no debe alcanzarse en producción.
export function createSubmitSessionProposalTool() {
  return betaZodTool({
    name: SUBMIT_SESSION_PROPOSAL_TOOL_NAME,
    description:
      "Entrega la propuesta final de sesión de entreno de hoy en formato estructurado. " +
      "Debe ser la última acción de la conversación: úsala solo cuando ya tengas toda la " +
      "información necesaria del historial y del catálogo.",
    inputSchema: sessionSchema,
    run: async () => "ok",
  });
}
