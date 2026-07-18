import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    // create-body-weight.ts y get-body-weight-history.ts (no mockeados en
    // este fichero: se ejercitan de verdad, ver tests de validación Zod más
    // abajo) llaman a estos dos métodos contra el prisma real. Se mockean
    // aquí para no tocar SQLite, y así poder verificar que NO se llaman
    // cuando la validación rechaza el input antes de llegar a la capa de
    // dominio o dentro de ella.
    bodyWeight: { create: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/list-exercises", () => ({ listExercises: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { listExercises } from "@/lib/list-exercises";
import { POST } from "./route";

const findUniqueMock = vi.mocked(prisma.user.findUnique);
const listExercisesMock = vi.mocked(listExercises);
const bodyWeightCreateMock = vi.mocked(prisma.bodyWeight.create);
const bodyWeightFindManyMock = vi.mocked(prisma.bodyWeight.findMany);

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
    bodyWeightCreateMock.mockReset();
    bodyWeightFindManyMock.mockReset();
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

  // Un token de la misma longitud que el real no debe dar ninguna ventaja
  // (ver auth.test.ts): se repite aquí a nivel de ruta para confirmar que la
  // ruta usa verifyBearerToken correctamente extremo a extremo.
  it("responde 401 sin tocar Prisma cuando el token es incorrecto pero tiene la misma longitud que el válido", async () => {
    const sameLengthWrongToken = "x".repeat(TOKEN.length);

    const response = await POST(
      mcpRequest(listExercisesCall, {
        authorization: `Bearer ${sameLengthWrongToken}`,
      }),
    );

    expect(response.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  // Un body que ni siquiera es JSON válido no debe tirar una excepción sin
  // controlar (500 sin manejar de Next.js): el propio transporte del SDK MCP
  // debe capturarlo y devolver un error JSON-RPC estructurado (-32700).
  it("responde con un error JSON-RPC estructurado (no una excepción sin controlar) ante un body que no es JSON válido", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01"),
    });

    const request = new NextRequest("http://localhost/api/mcp", {
      method: "POST",
      body: "{esto no es json",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${TOKEN}`,
      },
    });

    // No debe rechazar la promesa (eso sería un 500 sin manejar de Next.js):
    // debe resolver con una Response cuyo cuerpo ya es el error estructurado.
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.jsonrpc).toBe("2.0");
    expect(json.error.code).toBe(-32700);
  });

  // Un JSON perfectamente válido pero que no tiene forma de mensaje JSON-RPC
  // (falta jsonrpc/method) tampoco debe colar como una petición válida ni
  // provocar una excepción sin controlar.
  it("responde con un error JSON-RPC estructurado ante un JSON válido que no es un mensaje JSON-RPC", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01"),
    });

    const response = await POST(
      mcpRequest(
        { foo: "esto no es un mensaje jsonrpc" },
        { authorization: `Bearer ${TOKEN}` },
      ),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.jsonrpc).toBe("2.0");
    expect(json.error.code).toBe(-32700);
  });

  // log_weight reutiliza literalmente bodyWeightSchema (ver schemas.ts) como
  // inputSchema de la tool: esto prueba que el SDK MCP ejecuta de verdad esa
  // validación Zod ANTES de invocar el handler (y por tanto antes de tocar
  // Prisma), no que sea un passthrough silencioso.
  it("rechaza log_weight con weightKg de tipo incorrecto antes de tocar Prisma (Zod real, no passthrough)", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01"),
    });

    const response = await POST(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "log_weight",
            arguments: {
              weightKg: "ochenta", // debería ser number
              date: "2026-07-17T08:00:00.000Z",
            },
          },
        },
        { authorization: `Bearer ${TOKEN}` },
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.isError).toBe(true);
    expect(bodyWeightCreateMock).not.toHaveBeenCalled();
  });

  // get_weight_history usa un esquema MCP deliberadamente permisivo
  // (weightHistoryFilterSchema: cualquier string vale para desde/hasta), que
  // delega la regla real ("desde" <= "hasta") en getBodyWeightHistory. Esta
  // prueba confirma que esa delegación ocurre de punta a punta A TRAVÉS DE
  // LA RUTA (no solo llamando a getBodyWeightHistory directamente, que ya
  // se cubre en get-body-weight-history.test.ts): un filtro inválido se
  // rechaza sin llegar nunca a consultar Prisma.
  it("rechaza get_weight_history con desde posterior a hasta de punta a punta a través de la ruta", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
      createdAt: new Date("2026-01-01"),
    });

    const response = await POST(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "get_weight_history",
            arguments: {
              desde: "2026-06-01T00:00:00.000Z",
              hasta: "2026-01-01T00:00:00.000Z", // anterior a "desde"
            },
          },
        },
        { authorization: `Bearer ${TOKEN}` },
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.isError).toBe(true);
    expect(json.result.structuredContent.error.code).toBe("VALIDATION_ERROR");
    expect(bodyWeightFindManyMock).not.toHaveBeenCalled();
  });
});
