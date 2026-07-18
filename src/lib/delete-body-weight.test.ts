import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { deleteBodyWeight } from "./delete-body-weight";

const findFirstMock = vi.mocked(prisma.bodyWeight.findFirst);
const deleteMock = vi.mocked(prisma.bodyWeight.delete);

describe("deleteBodyWeight", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    deleteMock.mockReset();
  });

  it("borra el registro cuando pertenece al userId dado", async () => {
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

    const result = await deleteBodyWeight("user-1", "bw-1");

    expect(result.success).toBe(true);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "bw-1", userId: "user-1" },
    });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "bw-1" } });
  });

  it("devuelve un error NOT_FOUND sin borrar cuando el registro no existe", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await deleteBodyWeight("user-1", "bw-inexistente");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("devuelve un error NOT_FOUND sin borrar cuando el registro pertenece a otro usuario", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await deleteBodyWeight("user-2", "bw-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "bw-1", userId: "user-2" },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
