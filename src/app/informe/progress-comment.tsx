"use client";

import { useActionState } from "react";
import { generateAndSaveProgressComment } from "./actions";
import { ProgressCommentDisplay } from "./progress-comment-display";

export type ProgressCommentInitial = {
  texto: string;
  generadoEn: string;
} | null;

// Botón "bajo demanda" (SPEC.md §14 punto 2 / DECISIONS.md 2026-07-19): el
// comentario nunca se genera automáticamente, solo al pulsar. Un fallo
// (red, API) nunca debe bloquear la pantalla ni los gráficos existentes
// (que viven en un componente hermano, ProgressCharts, ajeno a este
// estado) — se refleja como aviso discreto y el último comentario que
// hubiera (guardado o de una generación anterior en esta misma sesión de
// navegador) se mantiene visible.
export function ProgressComment({
  initial,
}: {
  initial: ProgressCommentInitial;
}) {
  const [state, formAction, isPending] = useActionState(
    generateAndSaveProgressComment,
    undefined,
  );

  const comment =
    state && "success" in state && state.success
      ? { texto: state.texto, generadoEn: state.generadoEn }
      : initial;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Comentario de progreso</h2>
        <form action={formAction}>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {isPending ? "Generando..." : "Generar comentario de progreso"}
          </button>
        </form>
      </div>

      {comment ? (
        <ProgressCommentDisplay
          texto={comment.texto}
          generadoEn={comment.generadoEn}
        />
      ) : null}

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-black/60 dark:text-white/60">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
