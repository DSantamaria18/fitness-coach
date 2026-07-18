import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comentarioProgreso: {
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { saveProgressComment } from "./save-progress-comment";

const upsertMock = vi.mocked(prisma.comentarioProgreso.upsert);

describe("saveProgressComment", () => {
  beforeEach(() => {
    upsertMock.mockReset();
  });

  it("guarda el comentario mediante upsert (crea si no existía, sobrescribe si ya existía)", async () => {
    upsertMock.mockResolvedValue({
      id: "cp-1",
      userId: "user-1",
      texto: "Buen progreso esta semana.",
      generadoEn: new Date("2026-07-18T10:00:00.000Z"),
    });

    const result = await saveProgressComment(
      "user-1",
      "Buen progreso esta semana.",
    );

    expect(result).toEqual({
      success: true,
      data: {
        texto: "Buen progreso esta semana.",
        generadoEn: new Date("2026-07-18T10:00:00.000Z"),
      },
    });
    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: expect.objectContaining({
        userId: "user-1",
        texto: "Buen progreso esta semana.",
      }),
      update: expect.objectContaining({
        texto: "Buen progreso esta semana.",
      }),
    });
  });

  it("sobrescribe siempre el comentario anterior en una única llamada (nunca acumula histórico)", async () => {
    upsertMock.mockResolvedValue({
      id: "cp-1",
      userId: "user-1",
      texto: "Nuevo comentario.",
      generadoEn: new Date("2026-07-19T09:00:00.000Z"),
    });

    await saveProgressComment("user-1", "Nuevo comentario.");

    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("devuelve un error controlado si falla la escritura en base de datos", async () => {
    upsertMock.mockRejectedValue(new Error("db down"));

    const result = await saveProgressComment("user-1", "texto cualquiera");

    expect(result.success).toBe(false);
  });
});
