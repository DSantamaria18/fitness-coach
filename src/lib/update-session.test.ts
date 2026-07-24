import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findFirst: vi.fn(), update: vi.fn() },
    strengthEntry: { deleteMany: vi.fn() },
    cardioEntry: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/session-entries", () => ({
  resolveSessionEntries: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { resolveSessionEntries } from "@/lib/session-entries";
import { updateSession } from "./update-session";

const findFirstMock = vi.mocked(prisma.session.findFirst);
const sessionUpdateMock = vi.mocked(prisma.session.update);
const strengthDeleteManyMock = vi.mocked(prisma.strengthEntry.deleteMany);
const cardioDeleteManyMock = vi.mocked(prisma.cardioEntry.deleteMany);
const transactionMock = vi.mocked(prisma.$transaction);
const resolveSessionEntriesMock = vi.mocked(resolveSessionEntries);

const validInput = {
  fecha: "2026-07-17T08:00:00.000Z",
  ejercicios: [
    {
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      series: [{ reps: 5, peso_kg: 100 }],
    },
  ],
};

describe("updateSession", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    sessionUpdateMock.mockReset();
    strengthDeleteManyMock.mockReset();
    cardioDeleteManyMock.mockReset();
    transactionMock.mockReset();
    resolveSessionEntriesMock.mockReset();
    // La transacción real ejecuta el callback con un cliente `tx`; en los
    // tests reutilizamos el mismo mock de prisma como si fuera ese `tx`,
    // igual que create-session.test.ts.
    transactionMock.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) =>
        Promise.resolve(callback(prisma)),
    );
  });

  it("sustituye las entradas de una sesión existente dentro de una transacción", async () => {
    findFirstMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-07-01T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    resolveSessionEntriesMock.mockResolvedValue({
      success: true,
      data: {
        strengthEntries: [
          {
            exerciseId: "ex-1",
            notes: undefined,
            order: 0,
            sets: {
              create: [
                {
                  order: 0,
                  reps: 5,
                  weightKg: 100,
                  tempo: undefined,
                  rpe: undefined,
                },
              ],
            },
          },
        ],
        cardioEntries: [],
      },
    });
    sessionUpdateMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await updateSession("user-1", "s-1", validInput);

    expect(result).toEqual({
      success: true,
      data: { id: "s-1", date: new Date("2026-07-17T08:00:00.000Z") },
    });
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "s-1", userId: "user-1" },
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(strengthDeleteManyMock).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
    expect(cardioDeleteManyMock).toHaveBeenCalledWith({
      where: { sessionId: "s-1" },
    });
    expect(sessionUpdateMock).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: {
        date: new Date("2026-07-17T08:00:00.000Z"),
        strengthEntries: {
          create: [
            {
              exerciseId: "ex-1",
              notes: undefined,
              order: 0,
              sets: {
                create: [
                  {
                    order: 0,
                    reps: 5,
                    weightKg: 100,
                    tempo: undefined,
                    rpe: undefined,
                  },
                ],
              },
            },
          ],
        },
        cardioEntries: undefined,
      },
    });
  });

  it("devuelve un error de validación sin tocar Prisma cuando el input es inválido", async () => {
    const result = await updateSession("user-1", "s-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(resolveSessionEntriesMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Mismo criterio que create-session.test.ts: un fallo de validación debe
  // dejar rastro con los issues concretos de Zod, no solo el mensaje
  // genérico devuelto al usuario (ver DECISIONS.md).
  it("loguea los issues de Zod cuando el input es inválido", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await updateSession("user-1", "s-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [],
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[updateSession]"),
      expect.objectContaining({ issues: expect.any(Array) }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("devuelve un error NOT_FOUND sin llamar a resolveSessionEntries cuando la sesión no existe", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await updateSession("user-1", "s-inexistente", validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(resolveSessionEntriesMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("devuelve un error NOT_FOUND sin modificar nada cuando la sesión pertenece a otro usuario", async () => {
    // findFirst con where userId+id ya filtra esto, pero el test documenta
    // explícitamente la guarda de autorización a nivel de dominio, igual
    // que update-body-weight.test.ts.
    findFirstMock.mockResolvedValue(null);

    const result = await updateSession("user-2", "s-1", validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: "s-1", userId: "user-2" },
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("propaga el error sin abrir una transacción cuando un ejercicio no existe o no coincide su tipo", async () => {
    findFirstMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    resolveSessionEntriesMock.mockResolvedValue({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: 'El ejercicio "Sentadilla" no existe en el catálogo.',
      },
    });

    const result = await updateSession("user-1", "s-1", validInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
