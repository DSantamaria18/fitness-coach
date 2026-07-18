"use client";

import { useState } from "react";

// Componente compartido entre /sesion (crear) y /historial (editar): antes
// vivía duplicado dentro de session-form.tsx. Se extrajo aquí (en vez de a
// src/lib) porque es UI de cliente con estado propio de edición (añadir
// ejercicio/serie), no lógica de dominio — ver ARCHITECTURE.md/DECISIONS.md.

export type ExerciseType = "STRENGTH" | "CARDIO";
export type ExerciseOption = { id: string; name: string; type: ExerciseType };

type SerieState = { reps: string; peso_kg: string; tempo: string; RPE: string };

export type CardioMetricKey =
  | "duracion"
  | "distancia_km"
  | "velocidad_media"
  | "ritmo_medio"
  | "frecuencia_cardiaca_media"
  | "frecuencia_cardiaca_maxima"
  | "pasos"
  | "frecuencia_paso"
  | "kcal"
  | "RPE";

type FuerzaRegistroState = {
  key: string;
  tipo: "fuerza";
  ejercicio: string;
  series: SerieState[];
  notas: string;
};

type CardioRegistroState = {
  key: string;
  tipo: "cardio";
  ejercicio: string;
  notas: string;
} & Record<CardioMetricKey, string>;

export type RegistroState = FuerzaRegistroState | CardioRegistroState;

// Forma de "ejercicio ya registrado" que le pasa el Server Component padre
// al abrir el formulario de edición: mismos campos (en español) que
// devuelve get-session-history.ts/consume validate-session.ts, para no
// inventar un DTO paralelo. A diferencia de ValidatedRegistroEjercicio (Zod,
// campos opcionales como `T | undefined`), aquí los numéricos llegan como
// `T | null` porque salen directamente de Prisma.
export type SessionEntryInitialData =
  | {
      tipo: "fuerza";
      ejercicio: string;
      notas?: string | null;
      series: {
        reps: number;
        peso_kg: number;
        tempo?: string | null;
        RPE?: number | null;
      }[];
    }
  | {
      tipo: "cardio";
      ejercicio: string;
      notas?: string | null;
      duracion?: number | null;
      distancia_km?: number | null;
      velocidad_media?: number | null;
      ritmo_medio?: number | null;
      frecuencia_cardiaca_media?: number | null;
      frecuencia_cardiaca_maxima?: number | null;
      pasos?: number | null;
      frecuencia_paso?: number | null;
      kcal?: number | null;
      RPE?: number | null;
    };

export const CARDIO_FIELDS: { field: CardioMetricKey; label: string }[] = [
  { field: "duracion", label: "Duración (s)" },
  { field: "distancia_km", label: "Distancia (km)" },
  { field: "velocidad_media", label: "Vel. media (km/h)" },
  { field: "ritmo_medio", label: "Ritmo medio (s/km)" },
  { field: "frecuencia_cardiaca_media", label: "FC media" },
  { field: "frecuencia_cardiaca_maxima", label: "FC máxima" },
  { field: "pasos", label: "Pasos" },
  { field: "frecuencia_paso", label: "Cadencia" },
  { field: "kcal", label: "Kcal" },
  { field: "RPE", label: "RPE" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptySerie(): SerieState {
  return { reps: "", peso_kg: "", tempo: "", RPE: "" };
}

function emptyCardioMetrics(): Record<CardioMetricKey, string> {
  return {
    duracion: "",
    distancia_km: "",
    velocidad_media: "",
    ritmo_medio: "",
    frecuencia_cardiaca_media: "",
    frecuencia_cardiaca_maxima: "",
    pasos: "",
    frecuencia_paso: "",
    kcal: "",
    RPE: "",
  };
}

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalText(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

function toInputString(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

// Contador simple para claves de React estables entre añadir/quitar bloques;
// no necesita ser criptográfico, solo único dentro del ciclo de vida de la
// pestaña (se comparte entre todas las instancias del componente, igual que
// antes en session-form.tsx).
let registroSequence = 0;
function nextRegistroKey() {
  registroSequence += 1;
  return `registro-${registroSequence}`;
}

// Convierte los ejercicios ya guardados de una sesión (tal como los expone
// get-session-history.ts) al estado local (todo strings) que edita este
// componente. Usado por el formulario de edición de /historial para
// preellenar; /sesion (crear) simplemente no pasa valores iniciales.
export function buildInitialRegistros(
  entries: SessionEntryInitialData[],
): RegistroState[] {
  return entries.map((entry) => {
    if (entry.tipo === "fuerza") {
      return {
        key: nextRegistroKey(),
        tipo: "fuerza",
        ejercicio: entry.ejercicio,
        notas: entry.notas ?? "",
        series: entry.series.map((serie) => ({
          reps: String(serie.reps),
          peso_kg: String(serie.peso_kg),
          tempo: serie.tempo ?? "",
          RPE: toInputString(serie.RPE),
        })),
      };
    }

    return {
      key: nextRegistroKey(),
      tipo: "cardio",
      ejercicio: entry.ejercicio,
      notas: entry.notas ?? "",
      duracion: toInputString(entry.duracion),
      distancia_km: toInputString(entry.distancia_km),
      velocidad_media: toInputString(entry.velocidad_media),
      ritmo_medio: toInputString(entry.ritmo_medio),
      frecuencia_cardiaca_media: toInputString(entry.frecuencia_cardiaca_media),
      frecuencia_cardiaca_maxima: toInputString(
        entry.frecuencia_cardiaca_maxima,
      ),
      pasos: toInputString(entry.pasos),
      frecuencia_paso: toInputString(entry.frecuencia_paso),
      kcal: toInputString(entry.kcal),
      RPE: toInputString(entry.RPE),
    };
  });
}

// Convierte el estado local (todo strings, cómodo para <input>) al mismo
// contrato JSON que consume validate-session.ts, tanto al crear como al
// editar una sesión.
function buildSessionEntriesPayload(registros: RegistroState[]) {
  return registros.map((registro) => {
    if (registro.tipo === "fuerza") {
      return {
        tipo: "fuerza" as const,
        ejercicio: registro.ejercicio,
        notas: toOptionalText(registro.notas),
        series: registro.series.map((serie) => ({
          reps: toNumber(serie.reps),
          peso_kg: toNumber(serie.peso_kg),
          tempo: toOptionalText(serie.tempo),
          RPE: toNumber(serie.RPE),
        })),
      };
    }

    return {
      tipo: "cardio" as const,
      ejercicio: registro.ejercicio,
      notas: toOptionalText(registro.notas),
      duracion: toNumber(registro.duracion),
      distancia_km: toNumber(registro.distancia_km),
      velocidad_media: toNumber(registro.velocidad_media),
      ritmo_medio: toNumber(registro.ritmo_medio),
      frecuencia_cardiaca_media: toNumber(registro.frecuencia_cardiaca_media),
      frecuencia_cardiaca_maxima: toNumber(registro.frecuencia_cardiaca_maxima),
      pasos: toNumber(registro.pasos),
      frecuencia_paso: toNumber(registro.frecuencia_paso),
      kcal: toNumber(registro.kcal),
      RPE: toNumber(registro.RPE),
    };
  });
}

// `registros` es un prop controlado por el padre (no estado interno): tanto
// SessionForm (/sesion) como el formulario de edición de /historial
// necesitan conocer el número de ejercicios añadidos para habilitar/
// deshabilitar su propio botón de guardar, así que el estado vive en quien
// lo consume, no aquí — este componente es solo la UI de edición.
export function SessionEntriesEditor({
  exercises,
  initialDate,
  registros,
  onRegistrosChange,
}: {
  exercises: ExerciseOption[];
  initialDate?: string;
  registros: RegistroState[];
  onRegistrosChange: (registros: RegistroState[]) => void;
}) {
  const [selectedExercise, setSelectedExercise] = useState(
    exercises[0]?.name ?? "",
  );
  const today = todayIso();

  const exerciseByName = new Map(
    exercises.map((exercise) => [exercise.name, exercise]),
  );
  const fuerzaExercises = exercises.filter(
    (exercise) => exercise.type === "STRENGTH",
  );
  const cardioExercises = exercises.filter(
    (exercise) => exercise.type === "CARDIO",
  );

  function addRegistro() {
    const exercise = exerciseByName.get(selectedExercise);
    if (!exercise) return;

    if (exercise.type === "STRENGTH") {
      onRegistrosChange([
        ...registros,
        {
          key: nextRegistroKey(),
          tipo: "fuerza",
          ejercicio: exercise.name,
          series: [emptySerie()],
          notas: "",
        },
      ]);
    } else {
      onRegistrosChange([
        ...registros,
        {
          key: nextRegistroKey(),
          tipo: "cardio",
          ejercicio: exercise.name,
          notas: "",
          ...emptyCardioMetrics(),
        },
      ]);
    }
  }

  function removeRegistro(key: string) {
    onRegistrosChange(registros.filter((registro) => registro.key !== key));
  }

  function addSerie(key: string) {
    onRegistrosChange(
      registros.map((registro) =>
        registro.key === key && registro.tipo === "fuerza"
          ? { ...registro, series: [...registro.series, emptySerie()] }
          : registro,
      ),
    );
  }

  function removeSerie(key: string, index: number) {
    onRegistrosChange(
      registros.map((registro) =>
        registro.key === key && registro.tipo === "fuerza"
          ? {
              ...registro,
              series: registro.series.filter((_, i) => i !== index),
            }
          : registro,
      ),
    );
  }

  function updateSerie(
    key: string,
    index: number,
    field: keyof SerieState,
    value: string,
  ) {
    onRegistrosChange(
      registros.map((registro) =>
        registro.key === key && registro.tipo === "fuerza"
          ? {
              ...registro,
              series: registro.series.map((serie, i) =>
                i === index ? { ...serie, [field]: value } : serie,
              ),
            }
          : registro,
      ),
    );
  }

  function updateCardioField(
    key: string,
    field: CardioMetricKey,
    value: string,
  ) {
    onRegistrosChange(
      registros.map((registro) =>
        registro.key === key && registro.tipo === "cardio"
          ? { ...registro, [field]: value }
          : registro,
      ),
    );
  }

  function updateNotas(key: string, value: string) {
    onRegistrosChange(
      registros.map((registro) =>
        registro.key === key ? { ...registro, notas: value } : registro,
      ),
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="fecha" className="text-sm font-medium">
          Fecha
        </label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          defaultValue={initialDate ?? today}
          max={today}
          required
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
        <label htmlFor="exercise-picker" className="text-sm font-medium">
          Añadir ejercicio
        </label>
        <div className="flex gap-2">
          <select
            id="exercise-picker"
            value={selectedExercise}
            onChange={(event) => setSelectedExercise(event.target.value)}
            className="flex-1 rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
          >
            <optgroup label="Fuerza">
              {fuerzaExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cardio">
              {cardioExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            onClick={addRegistro}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Añadir
          </button>
        </div>
      </div>

      {registros.map((registro) => (
        <div
          key={registro.key}
          className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{registro.ejercicio}</h2>
            <button
              type="button"
              onClick={() => removeRegistro(registro.key)}
              className="text-xs text-red-600 dark:text-red-400"
            >
              Quitar ejercicio
            </button>
          </div>

          {registro.tipo === "fuerza" ? (
            <>
              {registro.series.map((serie, index) => (
                // Etiquetas implícitas (envolviendo el input) en vez de
                // htmlFor/id: las series se añaden/quitan dinámicamente y un
                // id fijo colisionaría entre filas repetidas.
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs">
                    Reps
                    <input
                      type="number"
                      inputMode="numeric"
                      value={serie.reps}
                      onChange={(event) =>
                        updateSerie(
                          registro.key,
                          index,
                          "reps",
                          event.target.value,
                        )
                      }
                      className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                    />
                  </label>
                  <label className="flex flex-col text-xs">
                    Peso (kg)
                    <input
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      value={serie.peso_kg}
                      onChange={(event) =>
                        updateSerie(
                          registro.key,
                          index,
                          "peso_kg",
                          event.target.value,
                        )
                      }
                      className="w-20 rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                    />
                  </label>
                  <label className="flex flex-col text-xs">
                    Tempo
                    <input
                      type="text"
                      value={serie.tempo}
                      onChange={(event) =>
                        updateSerie(
                          registro.key,
                          index,
                          "tempo",
                          event.target.value,
                        )
                      }
                      className="w-16 rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                    />
                  </label>
                  <label className="flex flex-col text-xs">
                    RPE
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={serie.RPE}
                      onChange={(event) =>
                        updateSerie(
                          registro.key,
                          index,
                          "RPE",
                          event.target.value,
                        )
                      }
                      className="w-14 rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                    />
                  </label>
                  {registro.series.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeSerie(registro.key, index)}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      Quitar serie
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSerie(registro.key)}
                className="self-start text-xs font-medium underline"
              >
                Añadir serie
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {CARDIO_FIELDS.map(({ field, label }) => (
                <label key={field} className="flex flex-col text-xs">
                  {label}
                  <input
                    type="number"
                    value={registro[field]}
                    onChange={(event) =>
                      updateCardioField(registro.key, field, event.target.value)
                    }
                    className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                  />
                </label>
              ))}
            </div>
          )}

          <label className="flex flex-col text-xs">
            Notas
            <input
              type="text"
              value={registro.notas}
              onChange={(event) =>
                updateNotas(registro.key, event.target.value)
              }
              className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
            />
          </label>
        </div>
      ))}

      {/* Los ejercicios no son representables como pares clave/valor planos
          de FormData (listas anidadas de series); se envían como JSON en un
          input oculto que la Server Action parsea (ver actions.ts). */}
      <input
        type="hidden"
        name="ejercicios"
        value={JSON.stringify(buildSessionEntriesPayload(registros))}
        readOnly
      />
    </>
  );
}
