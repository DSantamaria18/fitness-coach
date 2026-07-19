/* eslint-disable @typescript-eslint/no-explicit-any -- fake de Prisma en memoria solo para este test: tipar cada shape de argumento/fila añadiría ruido sin aportar seguridad real (nunca se compila contra el cliente de Prisma real). */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Round-trip de BL-004: registrar una sesión con orden intercalado
// (cardio-fuerza-cardio) → editarla sin cambiar nada (updateSession, el
// mismo camino que usa /historial al guardar el formulario de edición) →
// releerla (getSessionHistory + toSessionHistoryEntry) → el orden debe
// conservarse. Es justo el escenario real del bug (ver BACKLOG.md BL-004 y
// DECISIONS.md 2026-07-19), así que se ejercita a través de las funciones de
// dominio reales (create-session.ts/update-session.ts/get-session-history.ts),
// no solo de session-entries.ts en aislado.
//
// El resto de la suite mockea Prisma por llamada; aquí hace falta una
// versión mínima en memoria (vía vi.hoisted, ver docs de Vitest) porque el
// bug solo se manifiesta al encadenar tres operaciones de dominio que
// comparten el mismo estado subyacente (escribir, sustituir, leer).
const { exercises, sessions, strengthEntries, cardioEntries, resetStore } =
  vi.hoisted(() => {
    let idSeq = 0;
    function nextId(prefix: string) {
      idSeq += 1;
      return `${prefix}-${idSeq}`;
    }

    const exercises = [
      {
        id: "ex-fuerza",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
      {
        id: "ex-cardio",
        name: "Carrera",
        type: "CARDIO",
        createdAt: new Date(),
      },
    ];

    const sessions: {
      id: string;
      userId: string;
      date: Date;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];
    const strengthEntries: any[] = [];
    const cardioEntries: any[] = [];

    function resetStore() {
      idSeq = 0;
      sessions.length = 0;
      strengthEntries.length = 0;
      cardioEntries.length = 0;
    }

    return {
      exercises,
      sessions,
      strengthEntries,
      cardioEntries,
      resetStore,
      nextId,
    };
  });

vi.mock("@/lib/prisma", () => {
  let idSeq = 0;
  function nextId(prefix: string) {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  }

  function applyNestedEntries(sessionId: string, data: any) {
    if (data.strengthEntries?.create) {
      for (const entry of data.strengthEntries.create) {
        const entryId = nextId("strength-entry");
        strengthEntries.push({
          id: entryId,
          sessionId,
          exerciseId: entry.exerciseId,
          notes: entry.notes ?? null,
          order: entry.order,
          sets: entry.sets.create.map((set: any, index: number) => ({
            id: nextId("strength-set"),
            strengthEntryId: entryId,
            order: set.order ?? index,
            reps: set.reps,
            weightKg: set.weightKg,
            tempo: set.tempo ?? null,
            rpe: set.rpe ?? null,
          })),
        });
      }
    }
    if (data.cardioEntries?.create) {
      for (const entry of data.cardioEntries.create) {
        cardioEntries.push({
          id: nextId("cardio-entry"),
          sessionId,
          exerciseId: entry.exerciseId,
          order: entry.order,
          durationSeconds: entry.durationSeconds ?? null,
          distanceKm: entry.distanceKm ?? null,
          avgSpeedKmh: entry.avgSpeedKmh ?? null,
          avgPaceSecPerKm: entry.avgPaceSecPerKm ?? null,
          avgHeartRate: entry.avgHeartRate ?? null,
          maxHeartRate: entry.maxHeartRate ?? null,
          steps: entry.steps ?? null,
          stepFrequency: entry.stepFrequency ?? null,
          kcal: entry.kcal ?? null,
          rpe: entry.rpe ?? null,
          notes: entry.notes ?? null,
        });
      }
    }
  }

  const prisma: any = {
    exercise: {
      findMany: vi.fn(async ({ where }: any) =>
        exercises.filter((e) => where.name.in.includes(e.name)),
      ),
    },
    session: {
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: nextId("session"),
          userId: data.userId,
          date: data.date,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sessions.push(row);
        applyNestedEntries(row.id, data);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = sessions.find((s) => s.id === where.id)!;
        row.date = data.date;
        row.updatedAt = new Date();
        applyNestedEntries(row.id, data);
        return row;
      }),
      findFirst: vi.fn(
        async ({ where }: any) =>
          sessions.find(
            (s) => s.id === where.id && s.userId === where.userId,
          ) ?? null,
      ),
      findMany: vi.fn(async ({ where }: any) =>
        sessions
          .filter((s) => s.userId === where.userId)
          .map((s) => ({
            ...s,
            strengthEntries: strengthEntries
              .filter((e) => e.sessionId === s.id)
              .slice()
              .sort((a: any, b: any) => a.order - b.order)
              .map((e: any) => ({
                ...e,
                exercise: exercises.find((ex) => ex.id === e.exerciseId),
                sets: e.sets
                  .slice()
                  .sort((a: any, b: any) => a.order - b.order),
              })),
            cardioEntries: cardioEntries
              .filter((e) => e.sessionId === s.id)
              .slice()
              .sort((a: any, b: any) => a.order - b.order)
              .map((e: any) => ({
                ...e,
                exercise: exercises.find((ex) => ex.id === e.exerciseId),
              })),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime()),
      ),
    },
    strengthEntry: {
      deleteMany: vi.fn(async ({ where }: any) => {
        for (let i = strengthEntries.length - 1; i >= 0; i -= 1) {
          if (strengthEntries[i].sessionId === where.sessionId) {
            strengthEntries.splice(i, 1);
          }
        }
      }),
    },
    cardioEntry: {
      deleteMany: vi.fn(async ({ where }: any) => {
        for (let i = cardioEntries.length - 1; i >= 0; i -= 1) {
          if (cardioEntries[i].sessionId === where.sessionId) {
            cardioEntries.splice(i, 1);
          }
        }
      }),
    },
  };
  // La transacción real de Prisma expone un `tx` propio, pero para este fake
  // basta con ejecutar el callback contra el mismo objeto (mismo patrón que
  // update-session.test.ts).
  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback(prisma),
  );

  return { prisma };
});

import { createSession } from "@/lib/create-session";
import { updateSession } from "@/lib/update-session";
import { getSessionHistory } from "@/lib/get-session-history";
import { toSessionHistoryEntry } from "@/lib/to-session-history-entry";

const interleavedEjercicios = [
  { tipo: "cardio" as const, ejercicio: "Carrera", duracion: 1200 },
  {
    tipo: "fuerza" as const,
    ejercicio: "Sentadilla",
    series: [{ reps: 5, peso_kg: 100 }],
  },
  { tipo: "cardio" as const, ejercicio: "Carrera", duracion: 900 },
];

describe("orden intercalado de ejercicios: registrar, editar sin cambios y releer (BL-004)", () => {
  beforeEach(() => {
    resetStore();
  });

  it("conserva el orden cardio-fuerza-cardio original tras editar la sesión sin cambiar nada y volver a leerla", async () => {
    const created = await createSession("user-1", {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: interleavedEjercicios,
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    // "Editar sin cambiar nada" es justo el escenario real del bug: el
    // formulario de edición precarga los mismos ejercicios y los reenvía tal
    // cual si el usuario no toca nada.
    const updated = await updateSession("user-1", created.data.id, {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: interleavedEjercicios,
    });
    expect(updated.success).toBe(true);

    const history = await getSessionHistory("user-1");
    expect(history.success).toBe(true);
    if (!history.success) return;

    const [session] = history.data;
    const entry = toSessionHistoryEntry(session);

    expect(entry.ejercicios.map((e) => `${e.tipo}:${e.ejercicio}`)).toEqual([
      "cardio:Carrera",
      "fuerza:Sentadilla",
      "cardio:Carrera",
    ]);
  });
});
