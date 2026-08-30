import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { listExercises, listRecommendableExercises } from "./list-exercises";

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

describe("listRecommendableExercises", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("filters the catalog down to aiRecommendable: true, ordered by name", async () => {
    const catalog = [
      { id: "ex-1", name: "Carrera", type: "CARDIO", aiRecommendable: true },
    ];
    findManyMock.mockResolvedValue(catalog as never);

    const result = await listRecommendableExercises();

    expect(findManyMock).toHaveBeenCalledWith({
      where: { aiRecommendable: true },
      orderBy: { name: "asc" },
    });
    expect(result).toEqual(catalog);
  });
});
