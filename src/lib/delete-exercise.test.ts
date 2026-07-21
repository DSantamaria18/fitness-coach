import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { delete: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { deleteExercise } from "./delete-exercise";

const deleteMock = vi.mocked(prisma.exercise.delete);

describe("deleteExercise", () => {
  beforeEach(() => {
    deleteMock.mockReset();
  });

  it("borra el ejercicio cuando no tiene entradas asociadas", async () => {
    deleteMock.mockResolvedValue({
      id: "ex-1",
      name: "Bicicleta",
      type: "CARDIO",
      createdAt: new Date(),
    } as never);

    const result = await deleteExercise("ex-1");

    expect(result).toEqual({ success: true });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "ex-1" } });
  });

  it("devuelve IN_USE sin reventar cuando el ejercicio tiene sesiones asociadas (P2003)", async () => {
    deleteMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "test" },
      ),
    );

    const result = await deleteExercise("ex-1");

    expect(result).toEqual({
      success: false,
      error: {
        code: "IN_USE",
        message: "No se puede eliminar: ya tiene sesiones registradas.",
      },
    });
  });

  it("devuelve NOT_FOUND cuando el ejercicio no existe (P2025)", async () => {
    deleteMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    const result = await deleteExercise("ex-inexistente");

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Ejercicio no encontrado." },
    });
  });

  it("relanza errores inesperados de Prisma", async () => {
    deleteMock.mockRejectedValue(new Error("boom"));

    await expect(deleteExercise("ex-1")).rejects.toThrow("boom");
  });
});
