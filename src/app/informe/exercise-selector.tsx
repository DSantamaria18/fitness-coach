"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buildFilterUrl } from "./build-filter-url";

export type ExerciseOption = {
  id: string;
  name: string;
  type: "STRENGTH" | "CARDIO";
};

// Componente controlado por la URL (sin estado propio): el valor
// seleccionado viene siempre de `searchParams` vía el Server Component padre
// (page.tsx), igual que el resto del contrato de filtros de
// getProgressReport (SPEC.md §4/§5, ejercicio = nombre del catálogo).
export function ExerciseSelector({
  exercises,
  selected,
}: {
  exercises: ExerciseOption[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const fuerzaExercises = exercises.filter(
    (exercise) => exercise.type === "STRENGTH",
  );
  const cardioExercises = exercises.filter(
    (exercise) => exercise.type === "CARDIO",
  );

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    // Navegación de cliente (sin recarga completa): mantiene la página como
    // Server Component que vuelve a resolver getProgressReport con el
    // nuevo filtro a partir del searchParam. Se combina con los parámetros
    // ya presentes en la URL (p.ej. el rango de fechas de DateRangeFilter,
    // BL-005) en vez de reconstruirla desde cero, para que ambos filtros
    // convivan sin que uno borre al otro.
    router.push(buildFilterUrl(searchParams, { ejercicio: value || null }));
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="exercise-filter" className="text-sm font-medium">
        Filtrar por ejercicio
      </label>
      <select
        id="exercise-filter"
        value={selected}
        onChange={handleChange}
        className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/20"
      >
        <option value="">Todos</option>
        <optgroup label="Fuerza">
          {fuerzaExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.name}>
              {exercise.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Cardio">
          {cardioExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.name}>
              {exercise.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
