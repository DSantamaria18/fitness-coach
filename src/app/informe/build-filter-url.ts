// Construye la URL de /informe combinando los searchParams actuales con las
// actualizaciones indicadas, en vez de reconstruir la query desde cero como
// hacía ExerciseSelector antes de BL-005 — con dos filtros independientes
// (ejercicio y rango de fechas) conviviendo en la misma URL, cada componente
// solo debe tocar su propia clave y preservar las de los demás. `null` (o
// cadena vacía) borra el parámetro.
export function buildFilterUrl(
  currentParams: URLSearchParams,
  updates: Record<string, string | null>,
): string {
  const params = new URLSearchParams(currentParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/informe?${query}` : "/informe";
}
