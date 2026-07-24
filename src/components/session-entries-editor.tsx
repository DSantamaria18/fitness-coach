"use client";

import { useState } from "react";
import {
  nextRegistroKey,
  type CardioMetricKey,
  type RegistroState,
} from "@/lib/session-proposal/build-initial-registros";
import { parseMinutesSeconds } from "@/lib/duration-format";

// Componente compartido entre /sesion (crear) y /historial (editar): antes
// vivía duplicado dentro de session-form.tsx. Se extrajo aquí (en vez de a
// src/lib) porque es UI de cliente con estado propio de edición (añadir
// ejercicio/serie), no lógica de dominio — ver ARCHITECTURE.md/DECISIONS.md.
// Los tipos de datos y el conversor buildInitialRegistros sí viven en
// src/lib/session-proposal/build-initial-registros.ts: son lógica pura sin
// JSX/hooks que también necesita invocar una Server Action (actions.ts), y
// RSC prohíbe llamar desde el servidor a una función exportada por un
// módulo "use client" — ver DECISIONS.md 2026-07-19.

export type ExerciseType = "STRENGTH" | "CARDIO";
export type ExerciseOption = { id: string; name: string; type: ExerciseType };

// "mm:ss": texto libre en formato minutos:segundos (duración/ritmo), que el
// corredor piensa así en vez de en segundos totales — ver DECISIONS.md.
// "decimal": campos que admiten coma o punto (toNumber() normaliza) — deben
// ser type="text", no type="number": un <input type="number"> nunca deja
// llegar una coma a su .value (el navegador la descarta o la rechaza según
// locale), así que la tolerancia de toNumber() no tendría ningún efecto real
// si se dejaran como number. "integer": el resto de métricas (conteos:
// pulsaciones, pasos, kcal, RPE), sin cambio de tipo ni placeholder.
export type CardioFieldKind = "integer" | "decimal" | "mm:ss";

export const CARDIO_FIELDS: {
  field: CardioMetricKey;
  label: string;
  kind: CardioFieldKind;
  placeholder?: string;
}[] = [
  {
    field: "duracion",
    label: "Duración (mm:ss)",
    kind: "mm:ss",
    placeholder: "ej: 8:30",
  },
  {
    field: "distancia_km",
    label: "Distancia (km)",
    kind: "decimal",
    placeholder: "ej: 5,2",
  },
  {
    field: "velocidad_media",
    label: "Vel. media (km/h)",
    kind: "decimal",
    placeholder: "ej: 10,5",
  },
  {
    field: "ritmo_medio",
    label: "Ritmo medio (min:seg/km)",
    kind: "mm:ss",
    placeholder: "ej: 5:30",
  },
  { field: "frecuencia_cardiaca_media", label: "FC media", kind: "integer" },
  { field: "frecuencia_cardiaca_maxima", label: "FC máxima", kind: "integer" },
  { field: "pasos", label: "Pasos", kind: "integer" },
  {
    field: "frecuencia_paso",
    label: "Cadencia",
    kind: "decimal",
    placeholder: "ej: 170,5",
  },
  { field: "kcal", label: "Kcal", kind: "integer" },
  { field: "RPE", label: "RPE", kind: "integer" },
];

// Derivado de RegistroState (no redefinido a mano) para no desincronizarse
// de la forma de una serie de fuerza si esa unión cambia — RegistroState
// vive ahora en build-initial-registros.ts, ver comentario de imports.
type SerieState = Extract<RegistroState, { tipo: "fuerza" }>["series"][number];

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

// Normaliza coma decimal a punto antes de Number(): un valor prellenado por
// la IA (o tecleado en un dispositivo con locale es-ES) como "0,1" da NaN en
// Number("0,1") sin normalizar, descartando el dato en silencio sin avisar
// — el fallo que reportó el usuario. Aplica a todos los campos numéricos
// del editor (peso, distancia, velocidad, FC, cadencia, kcal, RPE).
function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// duracion/ritmo_medio se teclean en mm:ss pero el contrato de
// validate-session.ts/Prisma sigue siendo segundos totales — ver
// DECISIONS.md. Un formato inválido no lanza aquí (se resuelve a
// `undefined`, igual que el resto de campos opcionales), pero el usuario ya
// ve un aviso inline mientras edita (ver CARDIO_FIELDS/JSX más abajo) en vez
// de que el dato se descarte sin explicación.
function toSecondsFromMinutesSeconds(value: string): number | undefined {
  const result = parseMinutesSeconds(value);
  return result.success ? result.seconds : undefined;
}

function toOptionalText(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
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
      duracion: toSecondsFromMinutesSeconds(registro.duracion),
      distancia_km: toNumber(registro.distancia_km),
      velocidad_media: toNumber(registro.velocidad_media),
      ritmo_medio: toSecondsFromMinutesSeconds(registro.ritmo_medio),
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
            // min-w-0 anula el min-width:auto por defecto de los hijos flex:
            // sin él, un <select> con una opción larga (p. ej. "Elevaciones
            // laterales con mancuernas", añadida al ampliar el catálogo de
            // 12 a 27 ejercicios) no encoge por debajo de su ancho de
            // contenido, desborda la fila junto al botón "Añadir" y lo
            // empuja fuera del viewport en pantallas móviles estrechas
            // (~412px) — ver DECISIONS.md.
            className="min-w-0 flex-1 rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
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
                    {/* type="text" (no "number"): un <input type="number">
                        nunca deja llegar una coma a su .value, así que la
                        tolerancia a coma decimal de toNumber() no tendría
                        ningún efecto real si este campo siguiera siendo
                        number — ver comentario de CardioFieldKind. */}
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ej: 82,5"
                      title="Peso añadido a la serie, además de tu peso corporal. Déjalo vacío si el ejercicio es a peso corporal, sin lastre."
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
              {CARDIO_FIELDS.map(({ field, label, kind, placeholder }) => {
                const value = registro[field];
                // Aviso inline en vez de fallo mudo: un mm:ss mal escrito
                // (no vacío) se muestra al usuario de inmediato mientras
                // edita, en vez de convertirse en `undefined` sin que se
                // entere de que su dato no se guardó — el mismo tipo de
                // fallo silencioso que motivó este cambio (ver DECISIONS.md).
                const invalidMmSs =
                  kind === "mm:ss" &&
                  value.trim() !== "" &&
                  !parseMinutesSeconds(value).success;

                return (
                  <label key={field} className="flex flex-col text-xs">
                    {label}
                    <input
                      type={kind === "integer" ? "number" : "text"}
                      inputMode={
                        kind === "mm:ss"
                          ? "text"
                          : kind === "decimal"
                            ? "decimal"
                            : "numeric"
                      }
                      placeholder={placeholder}
                      pattern={
                        kind === "mm:ss" ? "\\d{1,3}:[0-5]\\d" : undefined
                      }
                      title={
                        kind === "mm:ss"
                          ? "Formato minutos:segundos, ej. 8:30"
                          : kind === "decimal"
                            ? "Admite coma o punto como separador decimal, ej. 5,2 o 5.2"
                            : undefined
                      }
                      aria-invalid={invalidMmSs || undefined}
                      value={value}
                      onChange={(event) =>
                        updateCardioField(
                          registro.key,
                          field,
                          event.target.value,
                        )
                      }
                      className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
                    />
                    {invalidMmSs ? (
                      <span
                        role="alert"
                        className="text-[11px] text-red-600 dark:text-red-400"
                      >
                        Formato inválido: usa min:seg, ej. 8:30.
                      </span>
                    ) : null}
                  </label>
                );
              })}
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
