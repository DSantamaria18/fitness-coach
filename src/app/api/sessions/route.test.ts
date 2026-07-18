import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findMany: vi.fn() },
    session: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

// `auth` es una función sobrecargada (uso directo y como middleware); vi.mocked
// infiere una intersección inservible para mockResolvedValue, así que se trata
// como un mock genérico.
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findManyMock = vi.mocked(prisma.exercise.findMany);
const sessionCreateMock = vi.mocked(prisma.session.create);
const transactionMock = vi.mocked(prisma.$transaction);

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validBody = {
  fecha: "2026-07-17T08:00:00.000Z",
  ejercicios: [
    {
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      series: [{ reps: 5, peso_kg: 100 }],
    },
  ],
};

describe("POST /api/sessions", () => {
  beforeEach(() => {
    authMock.mockReset();
    findManyMock.mockReset();
    sessionCreateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) =>
        Promise.resolve(callback(prisma)),
    );
  });

  it("responde 401 cuando no hay sesión, para que solo el usuario autenticado pueda registrar una sesión", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 400 con los detalles de validación cuando la sesión no tiene ejercicios", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(
      postRequest({ fecha: "2026-07-17T08:00:00.000Z", ejercicios: [] }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBeDefined();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando la fecha es futura", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(
      postRequest({ ...validBody, fecha: "2099-01-01T00:00:00.000Z" }),
    );

    expect(response.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el ejercicio referenciado no existe en el catálogo", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findManyMock.mockResolvedValue([]);

    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el cuerpo no es JSON válido, sin lanzar un 500", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await POST(postRequest("{ esto no es json"));

    expect(response.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("responde 201 con la sesión creada cuando el cuerpo es válido, usando el userId de la sesión y no del body", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findManyMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ] as never);
    sessionCreateMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await POST(
      postRequest({ ...validBody, userId: "someone-else" }),
    );

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.id).toBe("s-1");
    expect(sessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1" }),
      }),
    );
  });
});
