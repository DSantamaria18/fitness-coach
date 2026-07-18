import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

// `auth` es una función sobrecargada (uso directo y como middleware); vi.mocked
// infiere una intersección inservible para mockResolvedValue, así que se trata
// como un mock genérico.
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const createMock = vi.mocked(prisma.bodyWeight.create);
const findManyMock = vi.mocked(prisma.bodyWeight.findMany);

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/body-weight", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function getRequest(query = "") {
  return new NextRequest(`http://localhost/api/body-weight${query}`);
}

describe("POST /api/body-weight", () => {
  beforeEach(() => {
    authMock.mockReset();
    createMock.mockReset();
    findManyMock.mockReset();
  });

  it("responde 401 cuando no hay sesión, para que solo el usuario autenticado pueda registrar su peso", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      postRequest({ weightKg: 80, date: "2026-07-17T08:00:00.000Z" }),
    );

    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 400 con los detalles de validación cuando el peso es inválido", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(
      postRequest({ weightKg: -5, date: "2026-07-17T08:00:00.000Z" }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando la fecha es futura", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(
      postRequest({ weightKg: 80, date: "2099-01-01T00:00:00.000Z" }),
    );

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el cuerpo no es JSON válido, sin lanzar un 500", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(postRequest("{ esto no es json"));

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("responde 201 con el registro creado cuando el cuerpo es válido, usando el userId de la sesión y no del body", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    const created = {
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      weightKg: 80.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    createMock.mockResolvedValue(created);

    const response = await POST(
      postRequest({
        weightKg: 80.5,
        date: "2026-07-17T08:00:00.000Z",
        userId: "someone-else",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      JSON.parse(JSON.stringify(created)),
    );
    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        weightKg: 80.5,
        date: new Date("2026-07-17T08:00:00.000Z"),
      },
    });
  });
});

describe("GET /api/body-weight", () => {
  beforeEach(() => {
    authMock.mockReset();
    findManyMock.mockReset();
  });

  it("responde 401 cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHENTICATED");
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 200 con el historial del userId de la sesión, sin filtros", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findManyMock.mockResolvedValue([]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { date: "desc" },
    });
  });

  it("aplica los filtros desde/hasta recibidos por query string", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findManyMock.mockResolvedValue([]);

    const response = await GET(
      getRequest(
        "?desde=2026-01-01T00:00:00.000Z&hasta=2026-06-01T00:00:00.000Z",
      ),
    );

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lte: new Date("2026-06-01T00:00:00.000Z"),
        },
      },
      orderBy: { date: "desc" },
    });
  });

  it("responde 400 con el contrato de error estructurado cuando el rango de fechas es inválido", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await GET(
      getRequest(
        "?desde=2026-06-01T00:00:00.000Z&hasta=2026-01-01T00:00:00.000Z",
      ),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
