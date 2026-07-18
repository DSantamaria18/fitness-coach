import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { updateBodyWeight } from "./update-body-weight";

const findFirstMock = vi.mocked(prisma.bodyWeight.findFirst);
const updateMock = vi.mocked(prisma.bodyWeight.update);

describe("updateBodyWeight", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("actualiza el registro cuando pertenece al userId dado y el input es válido", async () => {
    findFirstMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      weightKg: 79,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    updateMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-07-01T00:00:00.000Z"),
      weightKg: 80.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await updateBodyWeight("user-1", "bw-1", {
      weightKg: 80.5,
      date: "2026-07-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "bw-1", userId: "user-1" },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "bw-1" },
      data: {
        weightKg: 80.5,
        date: new Date("2026-07-01T00:00:00.000Z"),
      },
    });
  });

  it("devuelve un error de validación sin tocar Prisma cuando el input es inválido", async () => {
    const result = await updateBodyWeight("user-1", "bw-1", {
      weightKg: -5,
      date: "2026-07-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("devuelve un error NOT_FOUND sin actualizar cuando el registro no existe", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await updateBodyWeight("user-1", "bw-inexistente", {
      weightKg: 80,
      date: "2026-07-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("devuelve un error NOT_FOUND sin actualizar cuando el registro pertenece a otro usuario", async () => {
    // findFirst con where userId+id ya filtra esto, pero el test documenta
    // explícitamente la guarda de autorización a nivel de dominio.
    findFirstMock.mockResolvedValue(null);

    const result = await updateBodyWeight("user-2", "bw-1", {
      weightKg: 80,
      date: "2026-07-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "bw-1", userId: "user-2" },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
