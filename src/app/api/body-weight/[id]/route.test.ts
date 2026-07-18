import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DELETE, PATCH } from "./route";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findFirstMock = vi.mocked(prisma.bodyWeight.findFirst);
const updateMock = vi.mocked(prisma.bodyWeight.update);
const deleteMock = vi.mocked(prisma.bodyWeight.delete);

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/body-weight/bw-1", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/body-weight/bw-1", {
    method: "DELETE",
  });
}

function context(id = "bw-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/body-weight/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("responde 401 cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ weightKg: 80, date: "2026-07-17T08:00:00.000Z" }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("responde 400 con el contrato de error estructurado cuando el cuerpo no es JSON válido", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await PATCH(patchRequest("{ esto no es json"), context());

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_JSON");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el peso o la fecha son inválidos", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);

    const response = await PATCH(
      patchRequest({ weightKg: -5, date: "2026-07-17T08:00:00.000Z" }),
      context(),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("responde 404 con el contrato de error estructurado cuando el registro no pertenece al userId de la sesión", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findFirstMock.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ weightKg: 80, date: "2026-07-17T08:00:00.000Z" }),
      context(),
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("responde 200 con el registro actualizado usando el userId de la sesión, no del body", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findFirstMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      weightKg: 79,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const updated = {
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      weightKg: 80.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    updateMock.mockResolvedValue(updated);

    const response = await PATCH(
      patchRequest({
        weightKg: 80.5,
        date: "2026-07-17T08:00:00.000Z",
        userId: "someone-else",
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "bw-1", userId: "user-1" },
    });
    await expect(response.json()).resolves.toEqual(
      JSON.parse(JSON.stringify(updated)),
    );
  });
});

describe("DELETE /api/body-weight/[id]", () => {
  beforeEach(() => {
    authMock.mockReset();
    findFirstMock.mockReset();
    deleteMock.mockReset();
  });

  it("responde 401 cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("responde 404 con el contrato de error estructurado cuando el registro no pertenece al userId de la sesión", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findFirstMock.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("responde 204 y borra el registro cuando pertenece al userId de la sesión", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    findFirstMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      weightKg: 79,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    deleteMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      weightKg: 79,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "bw-1" } });
  });
});
