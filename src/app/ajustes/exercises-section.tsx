"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createExerciseAction,
  deleteExerciseAction,
  renameExerciseAction,
} from "./actions";

export type ExerciseCatalogEntry = {
  id: string;
  name: string;
  type: "STRENGTH" | "CARDIO";
};

// Mismas etiquetas que el desplegable de "añadir ejercicio" en /sesion (ver
// SessionEntriesEditor), para no divergir el vocabulario entre pantallas.
const TYPE_LABELS: Record<ExerciseCatalogEntry["type"], string> = {
  STRENGTH: "Fuerza",
  CARDIO: "Cardio",
};

// Sección autocontenida dentro de /ajustes (no una ruta nueva, decisión de
// producto — ver DECISIONS.md), calcada del patrón ya usado en
// WeightHistorySection: alta con useActionState, edición inline por fila
// (toggle a formulario) y borrado con confirm() + llamada directa a la
// Server Action (no useActionState, para no acoplar un hook de formulario a
// un botón sin campos).
export function ExercisesSection({
  exercises,
}: {
  exercises: ExerciseCatalogEntry[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const strengthExercises = exercises.filter((e) => e.type === "STRENGTH");
  const cardioExercises = exercises.filter((e) => e.type === "CARDIO");

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Catálogo de ejercicios</h2>

      <ExerciseCreateForm />

      {exercises.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Todavía no hay ejercicios en el catálogo.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ExerciseGroup
            type="STRENGTH"
            entries={strengthExercises}
            editingId={editingId}
            setEditingId={setEditingId}
          />
          <ExerciseGroup
            type="CARDIO"
            entries={cardioExercises}
            editingId={editingId}
            setEditingId={setEditingId}
          />
        </div>
      )}
    </section>
  );
}

function ExerciseGroup({
  type,
  entries,
  editingId,
  setEditingId,
}: {
  type: ExerciseCatalogEntry["type"];
  entries: ExerciseCatalogEntry[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-black/60 dark:text-white/60">
        {TYPE_LABELS[type]}
      </h3>
      <ul className="flex flex-col gap-2">
        {entries.map((exercise) => (
          <li
            key={exercise.id}
            className="rounded-md border border-black/10 px-4 py-3 dark:border-white/15"
          >
            {editingId === exercise.id ? (
              <ExerciseEditForm
                exercise={exercise}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{exercise.name}</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(exercise.id)}
                    className="text-sm font-medium underline"
                  >
                    Editar
                  </button>
                  <DeleteExerciseButton id={exercise.id} />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExerciseCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createExerciseAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Limpia el formulario tras un alta con éxito: los <input>/<select> son
  // no controlados (defaultValue), así que basta con formRef.reset() en vez
  // de gestionar cada campo como estado de React.
  useEffect(() => {
    if (state && "success" in state && state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-black/10 p-3 dark:border-white/15"
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input
            name="name"
            type="text"
            required
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            name="type"
            defaultValue="STRENGTH"
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          >
            <option value="STRENGTH">Fuerza</option>
            <option value="CARDIO">Cardio</option>
          </select>
        </label>
      </div>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.success ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          ¡Ejercicio añadido!
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Añadir ejercicio"}
      </button>
    </form>
  );
}

function ExerciseEditForm({
  exercise,
  onCancel,
}: {
  exercise: ExerciseCatalogEntry;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    renameExerciseAction.bind(null, exercise.id),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input
            name="name"
            type="text"
            defaultValue={exercise.name}
            required
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            name="type"
            defaultValue={exercise.type}
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          >
            <option value="STRENGTH">Fuerza</option>
            <option value="CARDIO">Cardio</option>
          </select>
        </label>
      </div>

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
          disabled={isPending}
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

function DeleteExerciseButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Confirmación nativa, mismo criterio de simplicidad que
    // WeightHistorySection: suficiente para una acción destructiva de un
    // único usuario.
    if (!window.confirm("¿Seguro que quieres borrar este ejercicio?")) {
      return;
    }

    setIsPending(true);
    setError(null);
    const result = await deleteExerciseAction(id);
    setIsPending(false);

    // Si el borrado falla (p. ej. IN_USE porque ya tiene sesiones
    // registradas), el ejercicio se queda en la lista con el error visible
    // en vez de desaparecer — no hay revalidación optimista del lado
    // cliente, solo la de la Server Action tras un éxito real.
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
