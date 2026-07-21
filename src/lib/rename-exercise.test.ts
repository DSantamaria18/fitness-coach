import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { renameExercise } from "./rename-exercise";

const updateMock = vi.mocked(prisma.exercise.update);

describe("renameExercise", () => {
  beforeEach(() => {
    updateMock.mockReset();
  });

  it("renombra el ejercicio con nombre y tipo válidos", async () => {
    updateMock.mockResolvedValue({
      id: "ex-1",
      name: "Press de banca con mancuernas",
      type: "STRENGTH",
      createdAt: new Date(),
    } as never);

    const result = await renameExercise("ex-1", {
      name: "Press de banca con mancuernas",
      type: "STRENGTH",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: "ex-1",
        name: "Press de banca con mancuernas",
        type: "STRENGTH",
      });
    }
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "ex-1" },
      data: { name: "Press de banca con mancuernas", type: "STRENGTH" },
    });
  });

  it("devuelve VALIDATION_ERROR sin tocar Prisma cuando el input es inválido", async () => {
    const result = await renameExercise("ex-1", { name: "", type: "STRENGTH" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("devuelve VALIDATION_ERROR cuando colisiona con un nombre ya existente (P2002)", async () => {
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await renameExercise("ex-1", {
      name: "Sentadilla",
      type: "STRENGTH",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Ya existe un ejercicio con ese nombre.",
      },
    });
  });

  it("devuelve NOT_FOUND cuando el ejercicio no existe (P2025)", async () => {
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    const result = await renameExercise("ex-inexistente", {
      name: "Surf",
      type: "CARDIO",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Ejercicio no encontrado." },
    });
  });

  it("relanza errores inesperados de Prisma", async () => {
    updateMock.mockRejectedValue(new Error("boom"));

    await expect(
      renameExercise("ex-1", { name: "Surf", type: "CARDIO" }),
    ).rejects.toThrow("boom");
  });
});
