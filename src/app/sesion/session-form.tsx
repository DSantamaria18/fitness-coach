"use client";

import { useActionState, useState } from "react";
import { registerSession } from "./actions";
import {
  SessionEntriesEditor,
  type ExerciseOption,
  type RegistroState,
} from "@/components/session-entries-editor";

export function SessionForm({ exercises }: { exercises: ExerciseOption[] }) {
  const [state, formAction, isPending] = useActionState(
    registerSession,
    undefined,
  );
  const [registros, setRegistros] = useState<RegistroState[]>([]);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <SessionEntriesEditor
        exercises={exercises}
        registros={registros}
        onRegistrosChange={setRegistros}
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
