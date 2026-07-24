import { describe, expect, it } from "vitest";
import { validateSession } from "./validate-session";

function baseFuerza(overrides: Record<string, unknown> = {}) {
  return {
    tipo: "fuerza",
    ejercicio: "Sentadilla",
    series: [{ reps: 5, peso_kg: 100 }],
    ...overrides,
  };
}

function baseCardio(overrides: Record<string, unknown> = {}) {
  return {
    tipo: "cardio",
    ejercicio: "Carrera",
    ...overrides,
  };
}

describe("validateSession", () => {
  it("accepts a session with a single strength entry", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza()],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a session with a single cardio entry with all metrics omitted", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseCardio()],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a session mixing strength and cardio entries", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza(), baseCardio()],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a cardio entry with every optional metric provided", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [
        baseCardio({
          duracion: 1800,
          distancia_km: 5.2,
          velocidad_media: 10.4,
          ritmo_medio: 346,
          frecuencia_cardiaca_media: 150,
          frecuencia_cardiaca_maxima: 175,
          pasos: 6200,
          frecuencia_paso: 172.5,
          kcal: 420,
          RPE: 7,
          notas: "Sensaciones buenas",
        }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a strength entry with several sets including tempo and RPE", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [
        baseFuerza({
          series: [
            { reps: 5, peso_kg: 100, tempo: "3-1-1", RPE: 8 },
            { reps: 5, peso_kg: 100, RPE: 9 },
          ],
          notas: "Buena sesión",
        }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a past date", () => {
    const result = validateSession({
      fecha: "2026-01-01T00:00:00.000Z",
      ejercicios: [baseFuerza()],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a future date", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = validateSession({
      fecha: tomorrow.toISOString(),
      ejercicios: [baseFuerza()],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid date string", () => {
    const result = validateSession({
      fecha: "not-a-date",
      ejercicios: [baseFuerza()],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a session without any exercise entry", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a strength entry without any set", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [] })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a set with non-positive reps", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [{ reps: 0, peso_kg: 100 }] })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a set with non-integer reps", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [{ reps: 5.5, peso_kg: 100 }] })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a set with a non-positive weight", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [{ reps: 5, peso_kg: 0 }] })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a set with a negative weight", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [{ reps: 5, peso_kg: -10 }] })],
    });

    expect(result.success).toBe(false);
  });

  // Ejercicios a peso corporal (Burpees, Dominadas, Flexiones...) no tienen
  // una carga externa que registrar: la ausencia del campo es válida, solo
  // un valor explícito no positivo sigue sin tener sentido físico.
  it("accepts a set without peso_kg (bodyweight exercise)", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ series: [{ reps: 12 }] })],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a set with an RPE outside the 1-10 range", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [
        baseFuerza({ series: [{ reps: 5, peso_kg: 100, RPE: 11 }] }),
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a cardio entry with a non-positive duration", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseCardio({ duracion: -10 })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a cardio entry with an RPE outside the 1-10 range", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseCardio({ RPE: 0 })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an entry with an unknown tipo", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ tipo: "resistencia" })],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an entry without an ejercicio name", () => {
    const result = validateSession({
      fecha: new Date().toISOString(),
      ejercicios: [baseFuerza({ ejercicio: "" })],
    });

    expect(result.success).toBe(false);
  });
});
