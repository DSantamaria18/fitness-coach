"use client";

import { useActionState, useState } from "react";
import { registerSession } from "./actions";

type ExerciseType = "STRENGTH" | "CARDIO";

type ExerciseOption = { id: string; name: string; type: ExerciseType };

type SerieState = { reps: string; peso_kg: string; tempo: string; RPE: string };

type CardioMetricKey =
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

type RegistroState = FuerzaRegistroState | CardioRegistroState;

const CARDIO_FIELDS: { field: CardioMetricKey; label: string }[] = [
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

// Convierte el estado local (todo strings, cómodo para <input>) al mismo
// contrato JSON que consume validate-session.ts, tanto en /api/sessions
// como en la Server Action de este formulario.
function buildPayload(registros: RegistroState[]) {
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

// Contador simple para claves de React estables entre añadir/quitar bloques;
// no necesita ser criptográfico, solo único dentro del ciclo de vida del formulario.
let registroSequence = 0;
function nextRegistroKey() {
  registroSequence += 1;
  return `registro-${registroSequence}`;
}

export function SessionForm({ exercises }: { exercises: ExerciseOption[] }) {
  const [state, formAction, isPending] = useActionState(
    registerSession,
    undefined,
  );
  const [registros, setRegistros] = useState<RegistroState[]>([]);
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
      setRegistros((current) => [
        ...current,
        {
          key: nextRegistroKey(),
          tipo: "fuerza",
          ejercicio: exercise.name,
          series: [emptySerie()],
          notas: "",
        },
      ]);
    } else {
      setRegistros((current) => [
        ...current,
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
    setRegistros((current) =>
      current.filter((registro) => registro.key !== key),
    );
  }

  function addSerie(key: string) {
    setRegistros((current) =>
      current.map((registro) =>
        registro.key === key && registro.tipo === "fuerza"
          ? { ...registro, series: [...registro.series, emptySerie()] }
          : registro,
      ),
    );
  }

  function removeSerie(key: string, index: number) {
    setRegistros((current) =>
      current.map((registro) =>
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
    setRegistros((current) =>
      current.map((registro) =>
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
    setRegistros((current) =>
      current.map((registro) =>
        registro.key === key && registro.tipo === "cardio"
          ? { ...registro, [field]: value }
          : registro,
      ),
    );
  }

  function updateNotas(key: string, value: string) {
    setRegistros((current) =>
      current.map((registro) =>
        registro.key === key ? { ...registro, notas: value } : registro,
      ),
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fecha" className="text-sm font-medium">
          Fecha
        </label>
        <input
          id="fecha"
          name="fecha"
          type="date"
          defaultValue={today}
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
        value={JSON.stringify(buildPayload(registros))}
        readOnly
      />

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.success ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          ¡Sesión guardada!
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || registros.length === 0}
        className="rounded-md bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
