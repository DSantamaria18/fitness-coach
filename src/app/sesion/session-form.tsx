"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { registerSession, generateSessionProposalAction } from "./actions";
import {
  SessionEntriesEditor,
  type ExerciseOption,
} from "@/components/session-entries-editor";
import type { RegistroState } from "@/lib/session-proposal/build-initial-registros";

// Borrador en sessionStorage: sin esto, un móvil que descarta la pestaña en
// background (o cualquier recarga real de página) borra la propuesta de IA
// y lo que se llevara metido a mano, porque solo vivía en useState.
const DRAFT_STORAGE_KEY = "sesion-draft";

type SessionDraft = {
  fecha: string | undefined;
  registros: RegistroState[];
};

function readDraft(): SessionDraft {
  if (typeof window === "undefined") {
    return { fecha: undefined, registros: [] };
  }
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return { fecha: undefined, registros: [] };
    const parsed = JSON.parse(raw) as SessionDraft;
    return { fecha: parsed.fecha, registros: parsed.registros ?? [] };
  } catch {
    return { fecha: undefined, registros: [] };
  }
}

export function SessionForm({ exercises }: { exercises: ExerciseOption[] }) {
  const [state, formAction, isPending] = useActionState(
    registerSession,
    undefined,
  );
  const initialDraft = readDraft();
  const [registros, setRegistros] = useState<RegistroState[]>(
    initialDraft.registros,
  );
  const [initialDate, setInitialDate] = useState<string | undefined>(
    initialDraft.fecha,
  );
  // SessionEntriesEditor usa defaultValue (input no controlado) para la
  // fecha: cambiar la key fuerza un remount para que una fecha nueva
  // precargada por la IA se aplique de verdad (defaultValue solo se lee al
  // montar) sin tener que tocar ese componente compartido con /historial.
  const [editorKey, setEditorKey] = useState(0);
  const [isGeneratingProposal, startGeneratingProposal] = useTransition();
  const [proposalMessage, setProposalMessage] = useState<string | null>(null);

  useEffect(() => {
    if (registros.length === 0) {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ fecha: initialDate, registros }),
    );
  }, [registros, initialDate]);

  useEffect(() => {
    if (state && "success" in state && state.success) {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, [state]);

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
        className="rounded-md border border-iron/20 px-4 py-2 text-sm font-medium disabled:opacity-60"
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
        className="rounded-md bg-ember px-4 py-2 text-base font-medium text-black disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
