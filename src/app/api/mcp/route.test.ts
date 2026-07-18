import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/list-exercises", () => ({ listExercises: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { listExercises } from "@/lib/list-exercises";
import { POST } from "./route";

const findUniqueMock = vi.mocked(prisma.user.findUnique);
const listExercisesMock = vi.mocked(listExercises);

const TOKEN = "test-mcp-token";

// Cabeceras que exige el transporte Streamable HTTP del SDK MCP: el Accept
// debe listar ambos tipos aunque nunca lleguemos a abrir un stream SSE
// (usamos enableJsonResponse), y content-type debe ser JSON.
function mcpRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
  });
}

const listExercisesCall = {
  jsonrpc: "2.0" as const,
  id: 1,
  method: "tools/call",
  params: { name: "list_exercises", arguments: {} },
};

describe("POST /api/mcp", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    listExercisesMock.mockReset();
    vi.stubEnv("MCP_BEARER_TOKEN", TOKEN);
    vi.stubEnv("ADMIN_USERNAME", "david");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("responde 401 sin tocar Prisma cuando falta el header de autorización", async () => {
    const response = await POST(mcpRequest(listExercisesCall));

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("responde 401 sin tocar Prisma cuando el token es incorrecto", async () => {
    const response = await POST(
      mcpRequest(listExercisesCall, { authorization: "Bearer wrong-token" }),
    );

    expect(response.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("responde 500 cuando el usuario configurado (ADMIN_USERNAME) no existe en la base de datos", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await POST(
      mcpRequest(listExercisesCall, { authorization: `Bearer ${TOKEN}` }),
    );

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe("SERVER_MISCONFIGURED");
  });

  it("responde con el resultado de la tool cuando el token es válido y la llamada es correcta", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01"),
    });
    listExercisesMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const response = await POST(
      mcpRequest(listExercisesCall, { authorization: `Bearer ${TOKEN}` }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe(1);
    expect(json.result.isError).not.toBe(true);
    expect(json.result.structuredContent.data).toEqual([
      expect.objectContaining({ name: "Sentadilla" }),
    ]);
    // Se resuelve con el userId de ADMIN_USERNAME, nunca con uno recibido
    // en la petición (list_exercises ni siquiera lo necesita, pero el resto
    // de tools de esta misma ruta sí dependen de esta resolución).
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { username: "david" },
    });
  });
});
