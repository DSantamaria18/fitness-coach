import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveSessionEntries } from "./session-entries";

const findManyMock = vi.mocked(prisma.exercise.findMany);

describe("resolveSessionEntries", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("builds strength entries from validated exercises found in the catalog", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ] as never);

    const result = await resolveSessionEntries([
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        series: [{ reps: 5, peso_kg: 100, tempo: "3-1-1", RPE: 8 }],
        notas: "Buena sesión",
      },
    ]);

    expect(result).toEqual({
      success: true,
      data: {
        strengthEntries: [
          {
            exerciseId: "ex-1",
            notes: "Buena sesión",
            order: 0,
            sets: {
              create: [
                { order: 0, reps: 5, weightKg: 100, tempo: "3-1-1", rpe: 8 },
              ],
            },
          },
        ],
        cardioEntries: [],
      },
    });
  });

  it("builds cardio entries from validated exercises found in the catalog", async () => {
    findManyMock.mockResolvedValue([
      { id: "ex-2", name: "Carrera", type: "CARDIO", createdAt: new Date() },
    ] as never);

    const result = await resolveSessionEntries([
      {
        tipo: "cardio",
        ejercicio: "Carrera",
        duracion: 1800,
        distancia_km: 5.2,
        RPE: 6,
      },
    ]);

    expect(result).toEqual({
      success: true,
      data: {
        strengthEntries: [],
        cardioEntries: [
          {
            exerciseId: "ex-2",
            durationSeconds: 1800,
            distanceKm: 5.2,
            avgSpeedKmh: undefined,
            avgPaceSecPerKm: undefined,
            avgHeartRate: undefined,
            maxHeartRate: undefined,
            steps: undefined,
            stepFrequency: undefined,
            kcal: undefined,
            rpe: 6,
            notes: undefined,
          },
        ],
      },
    });
  });

  it("returns a failure result when a referenced exercise does not exist in the catalog", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await resolveSessionEntries([
      {
        tipo: "fuerza",
        ejercicio: "Ejercicio inventado",
        series: [{ reps: 5, peso_kg: 100 }],
      },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns a failure result when the exercise type does not match the entry type", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ] as never);

    const result = await resolveSessionEntries([
      { tipo: "cardio", ejercicio: "Sentadilla" },
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("queries the catalog only once per distinct exercise name", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ] as never);

    await resolveSessionEntries([
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        series: [{ reps: 5, peso_kg: 100 }],
      },
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        series: [{ reps: 3, peso_kg: 110 }],
      },
    ]);

    expect(findManyMock).toHaveBeenCalledWith({
      where: { name: { in: ["Sentadilla"] } },
    });
  });
});
