"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buildFilterUrl } from "./build-filter-url";

// Componente controlado por la URL (`?comparar=`), mismo patrón que
// ExerciseSelector/DateRangeFilter. Solo presets fijos (BL-006, decisión de
// producto ya cerrada): nada de rango libre a medida para la comparación.
export function ComparisonPeriodSelector({ selected }: { selected: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    // La comparación de periodos y el rango de fechas manual (BL-005) son
    // mutuamente excluyentes (decisión de producto): activar uno borra el
    // otro de la URL, en vez de dejar ambos coexistir con un resultado
    // ambiguo de cuál manda.
    router.push(
      buildFilterUrl(searchParams, {
        comparar: value || null,
        desde: null,
        hasta: null,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="comparison-period-selector"
        className="text-sm font-medium"
      >
        Comparar periodos
      </label>
      <select
        id="comparison-period-selector"
        value={selected}
        onChange={handleChange}
        className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
      >
        <option value="">Sin comparar</option>
        <option value="mes">Este mes vs. anterior</option>
        <option value="anio">Este año vs. anterior</option>
      </select>
    </div>
  );
}
