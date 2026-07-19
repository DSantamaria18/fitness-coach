import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findMany: vi.fn() },
    session: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { createSession } from "./create-session";

const findManyMock = vi.mocked(prisma.exercise.findMany);
const sessionCreateMock = vi.mocked(prisma.session.create);
const transactionMock = vi.mocked(prisma.$transaction);

describe("createSession", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    sessionCreateMock.mockReset();
    transactionMock.mockReset();
    // La transacción real ejecuta el callback con un cliente `tx`; en los
    // tests reutilizamos el mismo mock de prisma como si fuera ese `tx`.
    transactionMock.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) =>
        Promise.resolve(callback(prisma)),
    );
  });

  it("persists a session with a single strength entry inside a transaction", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ] as never);
    sessionCreateMock.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [
        {
          tipo: "fuerza",
          ejercicio: "Sentadilla",
          series: [{ reps: 5, peso_kg: 100, tempo: "3-1-1", RPE: 8 }],
          notas: "Buena sesión",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(sessionCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        date: new Date("2026-07-17T08:00:00.000Z"),
        strengthEntries: {
          create: [
            {
              exerciseId: "ex-1",
              notes: "Buena sesión",
              order: 0,
              sets: {
                create: [
                  {
                    order: 0,
                    reps: 5,
                    weightKg: 100,
                    tempo: "3-1-1",
                    rpe: 8,
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

  it("persists a session with a single cardio entry inside a transaction", async () => {
    findManyMock.mockResolvedValue([
      { id: "ex-2", name: "Carrera", type: "CARDIO", createdAt: new Date() },
    ] as never);
    sessionCreateMock.mockResolvedValue({
      id: "s-2",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [
        {
          tipo: "cardio",
          ejercicio: "Carrera",
          duracion: 1800,
          distancia_km: 5.2,
          RPE: 6,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(sessionCreateMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        date: new Date("2026-07-17T08:00:00.000Z"),
        strengthEntries: undefined,
        cardioEntries: {
          create: [
            {
              exerciseId: "ex-2",
              order: 0,
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
      },
    });
  });

  it("returns a failure result without touching Prisma when the input is invalid", async () => {
    const result = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result.success).toBe(false);
    expect(findManyMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns a failure result when a referenced exercise does not exist in the catalog", async () => {
    findManyMock.mockResolvedValue([]);

    const result = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [
        {
          tipo: "fuerza",
          ejercicio: "Ejercicio inventado",
          series: [{ reps: 5, peso_kg: 100 }],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
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

    const result = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [
        {
          tipo: "cardio",
          ejercicio: "Sentadilla",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
