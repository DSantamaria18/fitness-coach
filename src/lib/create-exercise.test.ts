import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { createExercise } from "./create-exercise";

const createMock = vi.mocked(prisma.exercise.create);

describe("createExercise", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("crea un ejercicio con nombre y tipo válidos", async () => {
    createMock.mockResolvedValue({
      id: "ex-1",
      name: "Surf",
      type: "CARDIO",
      createdAt: new Date(),
    } as never);

    const result = await createExercise({ name: "Surf", type: "CARDIO" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: "ex-1", name: "Surf", type: "CARDIO" });
    }
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Surf", type: "CARDIO" },
    });
  });

  it("recorta espacios en el nombre antes de guardarlo", async () => {
    createMock.mockResolvedValue({
      id: "ex-1",
      name: "Surf",
      type: "CARDIO",
      createdAt: new Date(),
    } as never);

    await createExercise({ name: "  Surf  ", type: "CARDIO" });

    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Surf", type: "CARDIO" },
    });
  });

  it("devuelve VALIDATION_ERROR sin tocar Prisma cuando el nombre está vacío", async () => {
    const result = await createExercise({ name: "   ", type: "CARDIO" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve VALIDATION_ERROR sin tocar Prisma cuando el tipo no es válido", async () => {
    const result = await createExercise({ name: "Surf", type: "YOGA" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("devuelve VALIDATION_ERROR cuando ya existe un ejercicio con ese nombre (P2002)", async () => {
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await createExercise({
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

  it("relanza errores inesperados de Prisma", async () => {
    createMock.mockRejectedValue(new Error("boom"));

    await expect(
      createExercise({ name: "Surf", type: "CARDIO" }),
    ).rejects.toThrow("boom");
  });
});
