import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { deleteSession } from "./delete-session";

const findFirstMock = vi.mocked(prisma.session.findFirst);
const deleteMock = vi.mocked(prisma.session.delete);

describe("deleteSession", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    deleteMock.mockReset();
  });

  it("borra la sesión cuando pertenece al userId dado", async () => {
    findFirstMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    deleteMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await deleteSession("user-1", "s-1");

    expect(result.success).toBe(true);
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "s-1", userId: "user-1" },
    });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "s-1" } });
  });

  it("devuelve un error NOT_FOUND sin borrar cuando la sesión no existe", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await deleteSession("user-1", "s-inexistente");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("devuelve un error NOT_FOUND sin borrar cuando la sesión pertenece a otro usuario", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await deleteSession("user-2", "s-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "s-1", userId: "user-2" },
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  // No hay deleteMany de StrengthEntry/CardioEntry aquí a propósito: el
  // esquema declara `onDelete: Cascade` en ambas relaciones hacia Session (y
  // StrengthSet hacia StrengthEntry), y se verificó empíricamente contra el
  // adapter @prisma/adapter-better-sqlite3 (ver DECISIONS.md) que SQLite
  // aplica esas cascadas en runtime, no solo en el esquema declarado. El
  // mock de prisma de este fichero solo expone `session.findFirst`/`delete`
  // a propósito: si la implementación intentara tocar StrengthEntry o
  // CardioEntry directamente, este test fallaría en tiempo de compilación
  // antes incluso de ejecutarse.
  it("borra la sesión con una única llamada a prisma.session.delete, sin borrar entradas relacionadas a mano (delegado a la cascada del esquema)", async () => {
    findFirstMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    deleteMock.mockResolvedValue({} as never);

    await deleteSession("user-1", "s-1");

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "s-1" } });
  });
});
