"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buildFilterUrl } from "./build-filter-url";

// Componente controlado por la URL (sin estado propio), mismo patrón que
// ExerciseSelector: el valor mostrado viene siempre de `searchParams` vía el
// Server Component padre (page.tsx). A diferencia de ExerciseSelector (que
// reconstruía la query desde cero), aquí se combina con
// useSearchParams()/buildFilterUrl para no perder el filtro de ejercicio (u
// otro futuro filtro) al cambiar solo la fecha — y viceversa, ver el mismo
// cambio aplicado a ExerciseSelector.
export function DateRangeFilter({
  desde,
  hasta,
}: {
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleDesdeChange(event: React.ChangeEvent<HTMLInputElement>) {
    router.push(
      buildFilterUrl(searchParams, {
        desde: event.target.value || null,
        // La comparación de periodos (BL-006) y el rango manual son
        // mutuamente excluyentes: fijar una fecha desactiva la comparación
        // ya activa, en vez de dejar ambas conviviendo con un resultado
        // ambiguo de cuál manda.
        comparar: null,
      }),
    );
  }

  function handleHastaChange(event: React.ChangeEvent<HTMLInputElement>) {
    router.push(
      buildFilterUrl(searchParams, {
        hasta: event.target.value || null,
        comparar: null,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label htmlFor="date-range-desde" className="text-sm font-medium">
          Desde
        </label>
        <input
          id="date-range-desde"
          type="date"
          value={desde}
          // No se puede elegir un "desde" posterior a "hasta" (guía nativa
          // del navegador; getProgressReport igualmente lo rechazaría).
          max={hasta || undefined}
          onChange={handleDesdeChange}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date-range-hasta" className="text-sm font-medium">
          Hasta
        </label>
        <input
          id="date-range-hasta"
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={handleHastaChange}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
        />
      </div>
    </div>
  );
}
