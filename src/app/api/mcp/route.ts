import type { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/mcp/auth";
import { resolveMcpUserId } from "@/lib/mcp/resolve-user";
import {
  logWeightSchema,
  logSessionSchema,
  editSessionSchema,
  weightHistoryFilterSchema,
  sessionHistoryFilterSchema,
  progressReportFilterSchema,
} from "@/lib/mcp/schemas";
import {
  logWeightTool,
  getWeightHistoryTool,
  logSessionTool,
  editSessionTool,
  getSessionHistoryTool,
  listExercisesTool,
  getProgressReportTool,
  type McpToolResult,
} from "@/lib/mcp/tools";

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

// El contrato de error de SPEC.md §5 ({ error: { code, message } }) se
// refleja tanto en éxito como en fallo dentro de structuredContent, para que
// un cliente MCP pueda leer el resultado estructurado sin tener que parsear
// el texto de `content`. `content` se mantiene igualmente porque el propio
// protocolo MCP lo espera de cualquier tool result.
function toCallToolResult(result: McpToolResult): CallToolResult {
  if (result.success) {
    return {
      content: [{ type: "text", text: JSON.stringify(result.data) }],
      structuredContent: { data: result.data },
    };
  }
  return {
    content: [{ type: "text", text: JSON.stringify({ error: result.error }) }],
    structuredContent: { error: result.error },
    isError: true,
  };
}

// Une el servidor MCP y sus 7 tools al userId ya resuelto de esta petición
// (nunca se deriva dentro de una tool, ver CLAUDE.md/DECISIONS.md).
//
// Cada registerTool se escribe como una llamada literal independiente (en vez
// de extraerlo a una función wrapper genérica): registerTool es un método
// genérico, y `Parameters<typeof server.registerTool>` fuera de una llamada
// real colapsa sus tipos a `never`, así que una única función auxiliar
// tipada de forma laxa rompía la inferencia de cada schema Zod concreto.
function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: "fitness-coach", version: "1.0.0" });

  server.registerTool(
    "log_weight",
    {
      description:
        "Registra el peso corporal de una fecha (hoy u otra pasada).",
      inputSchema: logWeightSchema,
    },
    async (args) => toCallToolResult(await logWeightTool(userId, args)),
  );

  server.registerTool(
    "get_weight_history",
    {
      description:
        "Consulta el historial de peso corporal, opcionalmente filtrado por rango de fechas.",
      inputSchema: weightHistoryFilterSchema,
    },
    async (args) => toCallToolResult(await getWeightHistoryTool(userId, args)),
  );

  server.registerTool(
    "log_session",
    {
      description:
        "Registra una sesión de entreno con uno o varios ejercicios de fuerza y/o cardio.",
      inputSchema: logSessionSchema,
    },
    async (args) => toCallToolResult(await logSessionTool(userId, args)),
  );

  server.registerTool(
    "edit_session",
    {
      description:
        "Edita una sesión de entreno existente (sustituye fecha y ejercicios por completo).",
      inputSchema: editSessionSchema,
    },
    async (args) => toCallToolResult(await editSessionTool(userId, args)),
  );

  server.registerTool(
    "get_session_history",
    {
      description:
        "Consulta el historial de sesiones, opcionalmente filtrado por fechas y/o ejercicio.",
      inputSchema: sessionHistoryFilterSchema,
    },
    async (args) => toCallToolResult(await getSessionHistoryTool(userId, args)),
  );

  server.registerTool(
    "get_progress_report",
    {
      description:
        "Informe de progreso: evolución de peso corporal, frecuencia de entreno y, si se filtra por ejercicio, su evolución específica.",
      inputSchema: progressReportFilterSchema,
    },
    async (args) => toCallToolResult(await getProgressReportTool(userId, args)),
  );

  // Catálogo cerrado (SPEC §3): no toma input ni depende del userId.
  server.registerTool(
    "list_exercises",
    { description: "Lista el catálogo cerrado de ejercicios disponibles." },
    async () => toCallToolResult(await listExercisesTool(userId, {})),
  );

  return server;
}

export async function POST(request: NextRequest): Promise<Response> {
  // La verificación del token va antes de tocar nada del protocolo MCP o de
  // Prisma (SPEC §7): un intento no autenticado no debe ni siquiera llegar a
  // resolver el usuario ni a parsear JSON-RPC.
  const expectedToken = process.env.MCP_BEARER_TOKEN ?? "";
  if (!verifyBearerToken(request.headers.get("authorization"), expectedToken)) {
    return jsonResponse(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Token de autenticación ausente o inválido.",
        },
      },
      401,
    );
  }

  // La app es de un único usuario: el userId se resuelve una vez por
  // petición a partir de ADMIN_USERNAME (misma variable que ya usa el login
  // web), nunca a partir del payload MCP. Que no exista es un fallo de
  // configuración del servidor (falta seed/ADMIN_USERNAME mal puesto), no
  // una situación esperable en uso normal — de ahí el 500 en vez de 401/404.
  const adminUsername = process.env.ADMIN_USERNAME ?? "";
  const userId = await resolveMcpUserId(prisma, adminUsername);
  if (!userId) {
    return jsonResponse(
      {
        error: {
          code: "SERVER_MISCONFIGURED",
          message:
            "No se encontró el usuario configurado (ADMIN_USERNAME) en la base de datos.",
        },
      },
      500,
    );
  }

  const server = buildMcpServer(userId);
  // Modo stateless: sessionIdGenerator undefined desactiva la gestión de
  // sesión del SDK (ver DECISIONS.md 2026-07-18) porque cada invocación de
  // este Route Handler puede correr en una instancia serverless distinta,
  // sin estado compartido entre peticiones. enableJsonResponse evita abrir
  // un stream SSE que no tiene dónde persistir entre llamadas.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}
