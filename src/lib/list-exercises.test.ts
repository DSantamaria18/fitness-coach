import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listExercises } from "./list-exercises";

const findManyMock = vi.mocked(prisma.exercise.findMany);

describe("listExercises", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("returns the exercise catalog ordered by name", async () => {
    const catalog = [
      { id: "ex-1", name: "Bicicleta", type: "CARDIO", createdAt: new Date() },
      {
        id: "ex-2",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ];
    findManyMock.mockResolvedValue(catalog as never);

    const result = await listExercises();

    expect(findManyMock).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
    expect(result).toEqual(catalog);
  });
});
