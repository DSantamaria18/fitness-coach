"use client";

import { useActionState } from "react";
import { registerBodyWeight } from "./actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function WeightForm() {
  const [state, formAction, isPending] = useActionState(
    registerBodyWeight,
    undefined,
  );
  const today = todayIso();

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="weight" className="text-sm font-medium">
          Peso (kg)
        </label>
        <input
          id="weight"
          name="weight"
          type="number"
          step="0.1"
          inputMode="decimal"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium">
          Fecha
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={today}
          max={today}
          required
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
        />
      </div>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state && state.success ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          ¡Peso guardado!
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-base font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
