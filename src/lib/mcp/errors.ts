export type McpToolError = { code: string; message: string };

// create-body-weight.ts y create-session.ts (a diferencia del resto de la
// capa de dominio) devuelven su error como string plano en vez de
// {code,message}: este es el único punto que normaliza esa inconsistencia
// para las tools MCP, en vez de duplicar el chequeo en cada tool.
export function toMcpToolError(
  error: string | McpToolError,
): McpToolError {
  if (typeof error === "string") {
    return { code: "VALIDATION_ERROR", message: error };
  }
  return error;
}
