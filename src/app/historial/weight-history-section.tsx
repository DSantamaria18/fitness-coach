"use client";

import { useActionState, useState } from "react";
import { deleteWeightEntry, updateWeightEntry } from "./actions";

// Las fechas viajan como ISO string (no Date) desde el Server Component
// padre: es una frontera cliente/servidor explícita y más fácil de testear
// que depender de la serialización implícita de Date en RSC.
export type WeightHistoryEntry = { id: string; weightKg: number; date: string };

// Fechas almacenadas en UTC, mostradas en Europe/Madrid (SPEC §3).
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

// El registro se creó a partir de un <input type="date"> tratado como
// medianoche UTC (ver peso/actions.ts), así que basta recortar el ISO para
// recuperar el mismo valor yyyy-mm-dd sin conversión de zona horaria.
function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

// Sección autocontenida para poder añadir más adelante, al lado, un
// historial de sesiones de entreno sin tocar este componente.
export function WeightHistorySection({
  entries,
}: {
  entries: WeightHistoryEntry[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Peso corporal</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Todavía no hay registros de peso.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-black/10 px-4 py-3 dark:border-white/15"
            >
              {editingId === entry.id ? (
                <WeightEntryEditForm
                  entry={entry}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="font-medium">{entry.weightKg} kg</span>
                    <span className="text-sm text-black/60 dark:text-white/60">
                      {formatDate(entry.date)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(entry.id)}
                      className="text-sm font-medium underline"
                    >
                      Editar
                    </button>
                    <DeleteWeightButton id={entry.id} />
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

function WeightEntryEditForm({
  entry,
  onCancel,
}: {
  entry: WeightHistoryEntry;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateWeightEntry.bind(null, entry.id),
    undefined,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Peso (kg)
          <input
            name="weight"
            type="number"
            step="0.1"
            inputMode="decimal"
            defaultValue={entry.weightKg}
            required
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha
          <input
            name="date"
            type="date"
            defaultValue={toDateInputValue(entry.date)}
            max={today}
            required
            className="rounded-md border border-black/15 px-2 py-1 text-base dark:border-white/20"
          />
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

function DeleteWeightButton({ id }: { id: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    // Confirmación nativa: suficiente para una acción destructiva de un
    // único usuario, sin necesidad de un diálogo a medida (CLAUDE.md regla 4
    // pide simplicidad, no sofisticación innecesaria).
    if (!window.confirm("¿Seguro que quieres borrar este registro de peso?")) {
      return;
    }

    setIsPending(true);
    setError(null);
    const result = await deleteWeightEntry(id);
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
