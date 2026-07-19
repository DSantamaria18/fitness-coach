import { describe, expect, it } from "vitest";
import { toSessionHistoryEntry } from "./to-session-history-entry";
import type { SessionHistoryEntry as DomainSessionHistoryEntry } from "./get-session-history";

// Construye una sesión "tal como la devuelve Prisma" (mismo shape que
// get-session-history.ts, con include+orderBy) con las entradas de fuerza y
// cardio ya indicadas, para poder controlar exactamente su `order` en el
// test sin depender de la base de datos.
function buildDomainSession(overrides: {
  strengthEntries?: DomainSessionHistoryEntry["strengthEntries"];
  cardioEntries?: DomainSessionHistoryEntry["cardioEntries"];
}): DomainSessionHistoryEntry {
  return {
    id: "session-1",
    userId: "user-1",
    date: new Date("2026-07-17T08:00:00.000Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
    strengthEntries: overrides.strengthEntries ?? [],
    cardioEntries: overrides.cardioEntries ?? [],
  } as DomainSessionHistoryEntry;
}

function strengthEntry(
  order: number,
  exerciseName: string,
): DomainSessionHistoryEntry["strengthEntries"][number] {
  return {
    id: `strength-${order}`,
    sessionId: "session-1",
    exerciseId: `ex-${exerciseName}`,
    notes: null,
    order,
    exercise: {
      id: `ex-${exerciseName}`,
      name: exerciseName,
      type: "STRENGTH",
      createdAt: new Date(),
    },
    sets: [
      {
        id: `set-${order}`,
        strengthEntryId: `strength-${order}`,
        order: 0,
        reps: 5,
        weightKg: 100,
        tempo: null,
        rpe: null,
      },
    ],
  } as DomainSessionHistoryEntry["strengthEntries"][number];
}

function cardioEntry(
  order: number,
  exerciseName: string,
): DomainSessionHistoryEntry["cardioEntries"][number] {
  return {
    id: `cardio-${order}`,
    sessionId: "session-1",
    exerciseId: `ex-${exerciseName}`,
    order,
    durationSeconds: 1200,
    distanceKm: null,
    avgSpeedKmh: null,
    avgPaceSecPerKm: null,
    avgHeartRate: null,
    maxHeartRate: null,
    steps: null,
    stepFrequency: null,
    kcal: null,
    rpe: null,
    notes: null,
    exercise: {
      id: `ex-${exerciseName}`,
      name: exerciseName,
      type: "CARDIO",
      createdAt: new Date(),
    },
  } as DomainSessionHistoryEntry["cardioEntries"][number];
}

describe("toSessionHistoryEntry", () => {
  it("fusiona strengthEntries y cardioEntries en un único array ordenado por el campo order, no concatenado en dos bloques", () => {
    // BL-004: strengthEntries y cardioEntries llegan ya ordenadas cada una
    // por su propio `order` (get-session-history.ts aplica orderBy en
    // ambas), pero siguen siendo dos arrays separados — concatenarlas sin
    // fusionar (fuerza primero, cardio después) rompe el orden real de una
    // sesión que intercala ambos tipos.
    const session = buildDomainSession({
      cardioEntries: [cardioEntry(0, "Carrera"), cardioEntry(2, "Carrera")],
      strengthEntries: [strengthEntry(1, "Sentadilla")],
    });

    const result = toSessionHistoryEntry(session);

    expect(result.ejercicios.map((e) => `${e.tipo}:${e.ejercicio}`)).toEqual([
      "cardio:Carrera",
      "fuerza:Sentadilla",
      "cardio:Carrera",
    ]);
  });

  it("conserva el id y la fecha (ISO) de la sesión", () => {
    const session = buildDomainSession({
      strengthEntries: [strengthEntry(0, "Sentadilla")],
    });

    const result = toSessionHistoryEntry(session);

    expect(result.id).toBe("session-1");
    expect(result.date).toBe("2026-07-17T08:00:00.000Z");
  });

  it("mapea los campos de fuerza y cardio al esquema en español que espera SessionEntriesEditor", () => {
    const session = buildDomainSession({
      strengthEntries: [strengthEntry(0, "Sentadilla")],
      cardioEntries: [cardioEntry(1, "Carrera")],
    });

    const result = toSessionHistoryEntry(session);

    expect(result.ejercicios[0]).toEqual({
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      notas: null,
      series: [{ reps: 5, peso_kg: 100, tempo: null, RPE: null }],
    });
    expect(result.ejercicios[1]).toEqual({
      tipo: "cardio",
      ejercicio: "Carrera",
      notas: null,
      duracion: 1200,
      distancia_km: null,
      velocidad_media: null,
      ritmo_medio: null,
      frecuencia_cardiaca_media: null,
      frecuencia_cardiaca_maxima: null,
      pasos: null,
      frecuencia_paso: null,
      kcal: null,
      RPE: null,
    });
  });
});
