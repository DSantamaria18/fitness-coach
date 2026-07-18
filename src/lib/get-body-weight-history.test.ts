import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getBodyWeightHistory } from "./get-body-weight-history";

const findManyMock = vi.mocked(prisma.bodyWeight.findMany);

describe("getBodyWeightHistory", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("lista los registros del userId dado ordenados por fecha descendente", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await getBodyWeightHistory("user-1");

    expect(result.success).toBe(true);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { date: "desc" },
    });
  });

  it("no filtra por fecha cuando no se pasan desde/hasta", async () => {
    findManyMock.mockResolvedValue([]);

    await getBodyWeightHistory("user-1", {});

    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { date: "desc" },
    });
  });

  it("aplica el filtro desde cuando solo se indica el límite inferior", async () => {
    findManyMock.mockResolvedValue([]);

    await getBodyWeightHistory("user-1", {
      desde: "2026-01-01T00:00:00.000Z",
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: new Date("2026-01-01T00:00:00.000Z") },
      },
      orderBy: { date: "desc" },
    });
  });

  it("aplica el filtro hasta cuando solo se indica el límite superior", async () => {
    findManyMock.mockResolvedValue([]);

    await getBodyWeightHistory("user-1", {
      hasta: "2026-06-01T00:00:00.000Z",
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { lte: new Date("2026-06-01T00:00:00.000Z") },
      },
      orderBy: { date: "desc" },
    });
  });

  it("aplica ambos límites cuando se indican desde y hasta", async () => {
    findManyMock.mockResolvedValue([]);

    await getBodyWeightHistory("user-1", {
      desde: "2026-01-01T00:00:00.000Z",
      hasta: "2026-06-01T00:00:00.000Z",
    });

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

  it("devuelve un error de validación sin consultar Prisma cuando desde es posterior a hasta", async () => {
    const result = await getBodyWeightHistory("user-1", {
      desde: "2026-06-01T00:00:00.000Z",
      hasta: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("devuelve un error de validación sin consultar Prisma cuando una fecha no es válida", async () => {
    const result = await getBodyWeightHistory("user-1", {
      desde: "no-es-una-fecha",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("propaga los registros encontrados en el resultado", async () => {
    const entries = [
      {
        id: "bw-1",
        userId: "user-1",
        date: new Date("2026-06-01T00:00:00.000Z"),
        weightKg: 79,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    findManyMock.mockResolvedValue(entries);

    const result = await getBodyWeightHistory("user-1");

    expect(result).toEqual({ success: true, data: entries });
  });
});
