import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getSessionHistory } from "./get-session-history";

const findManyMock = vi.mocked(prisma.session.findMany);

// Estructura de include esperada en cada llamada: entradas de fuerza (con
// sus series, ordenadas) y de cardio, cada una con el nombre de su
// ejercicio, para poder mostrar una sesión completa sin consultas extra.
const expectedInclude = {
  strengthEntries: {
    include: { exercise: true, sets: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  },
  // BL-004: sin este orderBy, CardioEntry se devolvía en el orden de
  // inserción de SQLite (implícito, no garantizado), rompiendo el orden
  // intercalado real de la sesión al fusionarlo con strengthEntries.
  cardioEntries: { include: { exercise: true }, orderBy: { order: "asc" } },
};

describe("getSessionHistory", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("lista las sesiones del userId dado ordenadas por fecha descendente", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await getSessionHistory("user-1");

    expect(result.success).toBe(true);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("no filtra por fecha ni ejercicio cuando no se pasan filtros", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", {});

    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("aplica el filtro desde cuando solo se indica el límite inferior", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", { desde: "2026-01-01T00:00:00.000Z" });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: new Date("2026-01-01T00:00:00.000Z") },
      },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("aplica el filtro hasta cuando solo se indica el límite superior", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", { hasta: "2026-06-01T00:00:00.000Z" });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { lte: new Date("2026-06-01T00:00:00.000Z") },
      },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("aplica ambos límites cuando se indican desde y hasta", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", {
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
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("filtra por sesiones que contienen el ejercicio indicado en fuerza o cardio", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", { ejercicio: "Sentadilla" });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { strengthEntries: { some: { exercise: { name: "Sentadilla" } } } },
          { cardioEntries: { some: { exercise: { name: "Sentadilla" } } } },
        ],
      },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("combina el filtro de ejercicio con el rango de fechas", async () => {
    findManyMock.mockResolvedValue([]);

    await getSessionHistory("user-1", {
      desde: "2026-01-01T00:00:00.000Z",
      ejercicio: "Carrera",
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        date: { gte: new Date("2026-01-01T00:00:00.000Z") },
        OR: [
          { strengthEntries: { some: { exercise: { name: "Carrera" } } } },
          { cardioEntries: { some: { exercise: { name: "Carrera" } } } },
        ],
      },
      include: expectedInclude,
      orderBy: { date: "desc" },
    });
  });

  it("devuelve un error de validación sin consultar Prisma cuando desde es posterior a hasta", async () => {
    const result = await getSessionHistory("user-1", {
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
    const result = await getSessionHistory("user-1", {
      desde: "no-es-una-fecha",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("devuelve un error de validación sin consultar Prisma cuando el ejercicio es una cadena vacía", async () => {
    const result = await getSessionHistory("user-1", { ejercicio: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("propaga las sesiones encontradas en el resultado", async () => {
    const sessions = [
      {
        id: "s-1",
        userId: "user-1",
        date: new Date("2026-07-17T08:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
        strengthEntries: [],
        cardioEntries: [],
      },
    ];
    findManyMock.mockResolvedValue(sessions as never);

    const result = await getSessionHistory("user-1");

    expect(result).toEqual({ success: true, data: sessions });
  });
});
