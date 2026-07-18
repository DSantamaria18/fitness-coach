import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comentarioProgreso: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getProgressComment } from "./get-progress-comment";

const findUniqueMock = vi.mocked(prisma.comentarioProgreso.findUnique);

describe("getProgressComment", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("devuelve el comentario guardado del usuario dado", async () => {
    findUniqueMock.mockResolvedValue({
      id: "cp-1",
      userId: "user-1",
      texto: "Vas muy bien.",
      generadoEn: new Date("2026-07-18T10:00:00.000Z"),
    });

    const result = await getProgressComment("user-1");

    expect(result).toEqual({
      texto: "Vas muy bien.",
      generadoEn: new Date("2026-07-18T10:00:00.000Z"),
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("devuelve null cuando el usuario todavía no tiene ningún comentario generado", async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await getProgressComment("user-1");

    expect(result).toBeNull();
  });
});
