"use client";

import { useActionState, useState } from "react";
import { deleteSessionEntry, updateSessionEntry } from "./actions";
import {
  SessionEntriesEditor,
  CARDIO_FIELDS,
  type ExerciseOption,
} from "@/components/session-entries-editor";
import {
  buildInitialRegistros,
  type RegistroState,
  type SessionEntryInitialData,
} from "@/lib/session-proposal/build-initial-registros";
import { formatSecondsAsMinutesSeconds } from "@/lib/duration-format";

// Mismo DTO que SessionEntryInitialData (los campos que consume el editor
// compartido): el Server Component padre serializa get-session-history.ts a
// esta forma, ver historial/page.tsx.
export type SessionHistoryEntry = {
  id: string;
  date: string;
  ejercicios: SessionEntryInitialData[];
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function formatSerie(serie: {
  reps: number;
  peso_kg?: number | null;
  tempo?: string | null;
  RPE?: number | null;
}) {
  // Ejercicios a peso corporal (Burpees, Dominadas...) no tienen carga
  // externa que mostrar (ver DECISIONS.md): "12 reps" en vez de inventar un
  // "0kg" o mostrar el "null" literal.
  const parts = [
    serie.peso_kg != null
      ? `${serie.reps}×${serie.peso_kg}kg`
      : `${serie.reps} reps (peso corporal)`,
  ];
  if (serie.tempo) parts.push(`tempo ${serie.tempo}`);
  if (serie.RPE != null) parts.push(`RPE ${serie.RPE}`);
  return parts.join(" · ");
}

function formatCardioSummary(
  entry: Extract<SessionEntryInitialData, { tipo: "cardio" }>,
) {
  const parts = CARDIO_FIELDS.filter(({ field }) => entry[field] != null).map(
    ({ field, label, kind }) => {
      const rawValue = entry[field];
      // duracion/ritmo_medio se guardan en segundos, pero el label ya dice
      // "(mm:ss)"/"(min:seg/km)" — mostrar el número crudo de segundos aquí
      // sería inconsistente con lo que el propio label anuncia (y con lo que
      // el formulario de edición ya muestra para el mismo dato). Ver
      // DECISIONS.md.
      const displayValue =
        kind === "mm:ss" && rawValue != null
          ? formatSecondsAsMinutesSeconds(rawValue)
          : rawValue;
      return `${label}: ${displayValue}`;
    },
  );
  return parts.length > 0 ? parts.join(" · ") : "Sin métricas registradas";
}

// Sección autocontenida junto a WeightHistorySection en historial/page.tsx:
// mismo patrón visual y estructural (listado + edición inline + borrado con
// confirm nativo).
export function SessionHistorySection({
  entries,
  exercises,
}: {
  entries: SessionHistoryEntry[];
  exercises: ExerciseOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Sesiones de entreno</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Todavía no hay sesiones registradas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-black/10 px-4 py-3 dark:border-white/15"
            >
              {editingId === entry.id ? (
                <SessionEntryEditForm
                  entry={entry}
                  exercises={exercises}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-black/60 dark:text-white/60">
                      {formatDate(entry.date)}
                    </span>
                    <ul className="flex flex-col gap-0.5 text-sm">
                      {entry.ejercicios.map((ejercicio, index) => (
                        <li key={index}>
                          <span className="font-medium">
                            {ejercicio.ejercicio}
                          </span>
                          :{" "}
                          {ejercicio.tipo === "fuerza"
                            ? ejercicio.series.map(formatSerie).join(", ")
                            : formatCardioSummary(ejercicio)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(entry.id)}
                      className="text-sm font-medium underline"
                    >
                      Editar
                    </button>
                    <DeleteSessionButton id={entry.id} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SessionEntryEditForm({
  entry,
  exercises,
  onCancel,
}: {
  entry: SessionHistoryEntry;
  exercises: ExerciseOption[];
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSessionEntry.bind(null, entry.id),
    undefined,
  );
  const [registros, setRegistros] = useState<RegistroState[]>(() =>
    buildInitialRegistros(entry.ejercicios),
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <SessionEntriesEditor
        exercises={exercises}
        initialDate={toDateInputValue(entry.date)}
        registros={registros}
        onRegistrosChange={setRegistros}
      />

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.success ? (
        <p className="text-sm text-green-600 dark:text-green-400">¡Guardado!</p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || registros.length === 0}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DeleteSessionButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Confirmación nativa: mismo criterio que DeleteWeightButton (CLAUDE.md
    // regla 4, un único usuario no necesita un diálogo a medida).
    if (!window.confirm("¿Seguro que quieres borrar esta sesión?")) {
      return;
    }

    setIsPending(true);
    setError(null);
    const result = await deleteSessionEntry(id);
    setIsPending(false);

    if ("error" in result) {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-sm font-medium text-red-600 underline disabled:opacity-60 dark:text-red-400"
      >
        {isPending ? "Borrando..." : "Borrar"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
