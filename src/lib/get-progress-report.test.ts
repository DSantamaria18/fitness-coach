import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exercise: { findFirst: vi.fn() },
    bodyWeight: { findMany: vi.fn() },
    session: { findMany: vi.fn() },
    strengthEntry: { findMany: vi.fn() },
    cardioEntry: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getProgressReport } from "./get-progress-report";

const exerciseFindFirstMock = vi.mocked(prisma.exercise.findFirst);
const bodyWeightFindManyMock = vi.mocked(prisma.bodyWeight.findMany);
const sessionFindManyMock = vi.mocked(prisma.session.findMany);
const strengthEntryFindManyMock = vi.mocked(prisma.strengthEntry.findMany);
const cardioEntryFindManyMock = vi.mocked(prisma.cardioEntry.findMany);

// Fecha de referencia usada como "hoy" en los tests de racha/frecuencia:
// un viernes de la semana ISO 2026-W29 (13 jul - 19 jul).
const NOW = new Date("2026-07-17T10:00:00.000Z");

describe("getProgressReport", () => {
  beforeEach(() => {
    exerciseFindFirstMock.mockReset();
    bodyWeightFindManyMock.mockReset();
    sessionFindManyMock.mockReset();
    strengthEntryFindManyMock.mockReset();
    cardioEntryFindManyMock.mockReset();

    bodyWeightFindManyMock.mockResolvedValue([]);
    sessionFindManyMock.mockResolvedValue([]);

    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validación", () => {
    it("devuelve VALIDATION_ERROR sin consultar Prisma cuando desde es posterior a hasta", async () => {
      const result = await getProgressReport("user-1", {
        desde: "2026-06-01T00:00:00.000Z",
        hasta: "2026-01-01T00:00:00.000Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(bodyWeightFindManyMock).not.toHaveBeenCalled();
    });

    it("devuelve VALIDATION_ERROR sin consultar Prisma cuando una fecha no es válida", async () => {
      const result = await getProgressReport("user-1", { desde: "no-fecha" });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(bodyWeightFindManyMock).not.toHaveBeenCalled();
    });

    it("devuelve VALIDATION_ERROR cuando ejercicio es una cadena vacía", async () => {
      const result = await getProgressReport("user-1", { ejercicio: "" });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(exerciseFindFirstMock).not.toHaveBeenCalled();
    });
  });

  describe("filtro por ejercicio inexistente", () => {
    it("devuelve NOT_FOUND cuando el ejercicio no existe en el catálogo", async () => {
      exerciseFindFirstMock.mockResolvedValue(null);

      const result = await getProgressReport("user-1", {
        ejercicio: "Ejercicio inventado",
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("NOT_FOUND");
      expect(bodyWeightFindManyMock).not.toHaveBeenCalled();
      expect(sessionFindManyMock).not.toHaveBeenCalled();
    });
  });

  describe("evolución de peso corporal", () => {
    it("devuelve los puntos de peso corporal ordenados ascendentemente por fecha", async () => {
      const entries = [
        {
          id: "bw-1",
          userId: "user-1",
          date: new Date("2026-06-01T00:00:00.000Z"),
          weightKg: 80,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      bodyWeightFindManyMock.mockResolvedValue(entries);

      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bodyWeight).toEqual([
          { date: new Date("2026-06-01T00:00:00.000Z"), weightKg: 80 },
        ]);
      }
      expect(bodyWeightFindManyMock).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { date: "asc" },
      });
    });

    it("aplica el filtro de fechas también a la consulta de peso corporal y sesiones", async () => {
      await getProgressReport("user-1", {
        desde: "2026-01-01T00:00:00.000Z",
        hasta: "2026-06-01T00:00:00.000Z",
      });

      const dateFilter = {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-06-01T00:00:00.000Z"),
      };
      expect(bodyWeightFindManyMock).toHaveBeenCalledWith({
        where: { userId: "user-1", date: dateFilter },
        orderBy: { date: "asc" },
      });
      expect(sessionFindManyMock).toHaveBeenCalledWith({
        where: { userId: "user-1", date: dateFilter },
        select: { date: true },
        orderBy: { date: "asc" },
      });
    });
  });

  describe("frecuencia de entrenamiento", () => {
    it("cuenta el total de sesiones y calcula la media semanal sobre el rango filtrado", async () => {
      sessionFindManyMock.mockResolvedValue([
        { date: new Date("2026-06-01T00:00:00.000Z") },
        { date: new Date("2026-06-08T00:00:00.000Z") },
        { date: new Date("2026-06-15T00:00:00.000Z") },
      ] as never);

      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency.totalSessions).toBe(3);
        // 3 sesiones repartidas en 3 semanas (una por semana) => media 1.
        expect(result.data.frequency.sessionsPerWeek).toBe(1);
      }
    });

    it("devuelve frecuencia cero cuando no hay sesiones", async () => {
      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency.totalSessions).toBe(0);
        expect(result.data.frequency.sessionsPerWeek).toBe(0);
        expect(result.data.frequency.currentStreakWeeks).toBe(0);
      }
    });
  });

  describe("racha de semanas consecutivas", () => {
    it("cuenta la semana actual y las anteriores consecutivas con al menos una sesión", async () => {
      // NOW cae en la semana ISO 2026-W29. Sesiones en W29, W28 y W27 (semana
      // actual + 2 anteriores consecutivas), con un hueco en W25.
      sessionFindManyMock.mockResolvedValue([
        { date: new Date("2026-07-16T00:00:00.000Z") }, // W29 (semana actual)
        { date: new Date("2026-07-09T00:00:00.000Z") }, // W28
        { date: new Date("2026-07-02T00:00:00.000Z") }, // W27
        { date: new Date("2026-06-18T00:00:00.000Z") }, // W25 (no consecutiva)
      ] as never);

      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency.currentStreakWeeks).toBe(3);
      }
    });

    it("la racha es cero si la semana actual no tiene ninguna sesión registrada", async () => {
      sessionFindManyMock.mockResolvedValue([
        { date: new Date("2026-07-09T00:00:00.000Z") }, // W28, no la semana actual
      ] as never);

      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency.currentStreakWeeks).toBe(0);
      }
    });
  });

  describe("progreso de un ejercicio de fuerza", () => {
    it("calcula el peso máximo y el volumen total por sesión", async () => {
      exerciseFindFirstMock.mockResolvedValue({
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      } as never);
      strengthEntryFindManyMock.mockResolvedValue([
        {
          id: "se-1",
          sessionId: "s-1",
          exerciseId: "ex-1",
          notes: null,
          order: 0,
          session: { id: "s-1", date: new Date("2026-06-01T00:00:00.000Z") },
          sets: [
            {
              id: "set-1",
              order: 0,
              reps: 5,
              weightKg: 100,
              tempo: null,
              rpe: null,
            },
            {
              id: "set-2",
              order: 1,
              reps: 5,
              weightKg: 105,
              tempo: null,
              rpe: null,
            },
          ],
        },
      ] as never);

      const result = await getProgressReport("user-1", {
        ejercicio: "Sentadilla",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exercise).toEqual({
          exercise: "Sentadilla",
          type: "STRENGTH",
          points: [
            {
              sessionId: "s-1",
              date: new Date("2026-06-01T00:00:00.000Z"),
              maxWeightKg: 105,
              totalVolumeKg: 5 * 100 + 5 * 105,
            },
          ],
        });
      }
      expect(strengthEntryFindManyMock).toHaveBeenCalledWith({
        where: { exerciseId: "ex-1", session: { userId: "user-1" } },
        include: { sets: true, session: true },
        orderBy: { session: { date: "asc" } },
      });
      expect(cardioEntryFindManyMock).not.toHaveBeenCalled();
    });
  });

  describe("progreso de un ejercicio de cardio", () => {
    it("expone distancia, duración y ritmo medio por sesión", async () => {
      exerciseFindFirstMock.mockResolvedValue({
        id: "ex-2",
        name: "Carrera",
        type: "CARDIO",
        createdAt: new Date(),
      } as never);
      cardioEntryFindManyMock.mockResolvedValue([
        {
          id: "ce-1",
          sessionId: "s-2",
          exerciseId: "ex-2",
          durationSeconds: 1800,
          distanceKm: 5.2,
          avgSpeedKmh: null,
          avgPaceSecPerKm: 346,
          avgHeartRate: null,
          maxHeartRate: null,
          steps: null,
          stepFrequency: null,
          kcal: null,
          rpe: null,
          notes: null,
          session: { id: "s-2", date: new Date("2026-06-02T00:00:00.000Z") },
        },
      ] as never);

      const result = await getProgressReport("user-1", {
        ejercicio: "Carrera",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exercise).toEqual({
          exercise: "Carrera",
          type: "CARDIO",
          points: [
            {
              sessionId: "s-2",
              date: new Date("2026-06-02T00:00:00.000Z"),
              distanceKm: 5.2,
              durationSeconds: 1800,
              avgPaceSecPerKm: 346,
            },
          ],
        });
      }
      expect(strengthEntryFindManyMock).not.toHaveBeenCalled();
    });
  });

  describe("sin filtro de ejercicio", () => {
    it("no incluye la clave exercise en el resultado", async () => {
      const result = await getProgressReport("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exercise).toBeUndefined();
      }
      expect(exerciseFindFirstMock).not.toHaveBeenCalled();
      expect(strengthEntryFindManyMock).not.toHaveBeenCalled();
      expect(cardioEntryFindManyMock).not.toHaveBeenCalled();
    });
  });
});
