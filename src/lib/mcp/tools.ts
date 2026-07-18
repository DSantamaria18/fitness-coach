import { createBodyWeight } from "@/lib/create-body-weight";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";
import { createSession } from "@/lib/create-session";
import { updateSession } from "@/lib/update-session";
import { getSessionHistory } from "@/lib/get-session-history";
import { listExercises } from "@/lib/list-exercises";
import { getProgressReport } from "@/lib/get-progress-report";
import { toMcpToolError, type McpToolError } from "./errors";

export type McpToolResult =
  { success: true; data: unknown } | { success: false; error: McpToolError };

export type McpToolHandler = (
  userId: string,
  input: unknown,
) => Promise<McpToolResult>;

export const logWeightTool: McpToolHandler = async (userId, input) => {
  const result = await createBodyWeight(userId, input);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};

export const getWeightHistoryTool: McpToolHandler = async (userId, input) => {
  const result = await getBodyWeightHistory(userId, input);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};

export const logSessionTool: McpToolHandler = async (userId, input) => {
  const result = await createSession(userId, input);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};

// edit_session (SPEC §5) recibe { id, ...cambios }: el id no forma parte del
// esquema de validate-session.ts (que solo modela fecha+ejercicios), así que
// se extrae aquí, antes de delegar en updateSession, que ya exige el id como
// parámetro explícito separado del resto del payload.
export const editSessionTool: McpToolHandler = async (userId, input) => {
  if (typeof input !== "object" || input === null || !("id" in input)) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Falta el id de la sesión a editar.",
      },
    };
  }

  const { id, ...changes } = input as { id: unknown; [key: string]: unknown };
  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Falta el id de la sesión a editar.",
      },
    };
  }

  const result = await updateSession(userId, id, changes);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};

export const getSessionHistoryTool: McpToolHandler = async (userId, input) => {
  const result = await getSessionHistory(userId, input);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};

// Catálogo global (SPEC §3): no depende del userId ni acepta filtros.
export const listExercisesTool: McpToolHandler = async () => {
  const data = await listExercises();
  return { success: true, data };
};

export const getProgressReportTool: McpToolHandler = async (userId, input) => {
  const result = await getProgressReport(userId, input);
  if (!result.success) {
    return { success: false, error: toMcpToolError(result.error) };
  }
  return { success: true, data: result.data };
};
