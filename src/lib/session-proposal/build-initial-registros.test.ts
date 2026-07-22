import { describe, expect, it } from "vitest";
import { buildInitialRegistros } from "./build-initial-registros";

describe("buildInitialRegistros", () => {
  it("convierte un ejercicio de fuerza a estado local (todo strings)", () => {
    const [registro] = buildInitialRegistros([
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        notas: "Buena sesión",
        series: [
          { reps: 5, peso_kg: 100, tempo: "3-1-1", RPE: 8 },
          { reps: 5, peso_kg: 105, tempo: null, RPE: null },
        ],
      },
    ]);

    expect(registro).toMatchObject({
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      notas: "Buena sesión",
      series: [
        { reps: "5", peso_kg: "100", tempo: "3-1-1", RPE: "8" },
        { reps: "5", peso_kg: "105", tempo: "", RPE: "" },
      ],
    });
    expect(registro.key).toBeTruthy();
  });

  it("usa cadena vacía como notas cuando no vienen informadas (null o undefined)", () => {
    const [registro] = buildInitialRegistros([
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        series: [{ reps: 5, peso_kg: 100 }],
      },
    ]);

    expect(registro.notas).toBe("");
  });

  it("convierte un ejercicio de cardio, dejando en blanco las métricas no informadas", () => {
    const [registro] = buildInitialRegistros([
      {
        tipo: "cardio",
        ejercicio: "Carrera",
        duracion: 1800,
        distancia_km: 5,
        velocidad_media: null,
        ritmo_medio: null,
        frecuencia_cardiaca_media: null,
        frecuencia_cardiaca_maxima: null,
        pasos: null,
        frecuencia_paso: null,
        kcal: null,
        RPE: 6,
      },
    ]);

    // duracion se guarda en segundos (1800) pero se precarga en mm:ss
    // ("30:00"): un corredor piensa la duración en minutos, no en segundos
    // totales — ver DECISIONS.md.
    expect(registro).toMatchObject({
      tipo: "cardio",
      ejercicio: "Carrera",
      duracion: "30:00",
      distancia_km: "5",
      velocidad_media: "",
      RPE: "6",
    });
  });

  it("precarga ritmo_medio (segundos/km guardados) también en mm:ss", () => {
    const [registro] = buildInitialRegistros([
      {
        tipo: "cardio",
        ejercicio: "Carrera",
        ritmo_medio: 330,
      },
    ]);

    expect(registro).toMatchObject({ tipo: "cardio", ritmo_medio: "5:30" });
  });

  it("asigna una clave distinta y no vacía a cada registro convertido, en el mismo orden de entrada", () => {
    const registros = buildInitialRegistros([
      {
        tipo: "fuerza",
        ejercicio: "Sentadilla",
        series: [{ reps: 5, peso_kg: 100 }],
      },
      { tipo: "cardio", ejercicio: "Carrera", duracion: 1800 },
    ]);

    expect(registros).toHaveLength(2);
    expect(registros[0].ejercicio).toBe("Sentadilla");
    expect(registros[1].ejercicio).toBe("Carrera");
    expect(registros[0].key).toBeTruthy();
    expect(registros[1].key).toBeTruthy();
    expect(registros[0].key).not.toBe(registros[1].key);
  });

  it("devuelve un array vacío cuando no hay ejercicios", () => {
    expect(buildInitialRegistros([])).toEqual([]);
  });
});
