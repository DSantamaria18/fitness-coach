"use client";

import { useActionState, useState, useTransition } from "react";
import { registerSession, generateSessionProposalAction } from "./actions";
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
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  // SessionEntriesEditor usa defaultValue (input no controlado) para la
  // fecha: cambiar la key fuerza un remount para que una fecha nueva
  // precargada por la IA se aplique de verdad (defaultValue solo se lee al
  // montar) sin tener que tocar ese componente compartido con /historial.
  const [editorKey, setEditorKey] = useState(0);
  const [isGeneratingProposal, startGeneratingProposal] = useTransition();
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);

  function handleGenerateProposal() {
    setProposalMessage(null);
    startGeneratingProposal(async () => {
      const result = await generateSessionProposalAction();
      if (!result.success) {
        setProposalMessage(result.message);
        return;
      }
      setInitialDate(result.fecha);
      setRegistros(result.registros);
      setEditorKey((key) => key + 1);
    });
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <button
        type="button"
        onClick={handleGenerateProposal}
        disabled={isGeneratingProposal}
        className="rounded-md border border-black/20 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/25"
      >
        {isGeneratingProposal ? "Generando…" : "Generar propuesta con IA"}
      </button>

      {proposalMessage ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {proposalMessage}
        </p>
      ) : null}

      <SessionEntriesEditor
        key={editorKey}
        exercises={exercises}
        initialDate={initialDate}
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
