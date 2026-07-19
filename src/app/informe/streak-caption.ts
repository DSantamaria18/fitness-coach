// currentStreakWeeks siempre cuenta hacia atrás desde la fecha real del
// sistema, ignorando el filtro `hasta` (ver DECISIONS.md 2026-07-18): sin
// aviso, un rango de fechas en el pasado mostraría racha 0 de forma
// confusa aunque hubiera una racha larga dentro de ese rango. El aviso solo
// se añade cuando `hasta` está realmente aplicado (BL-005), para no
// alargar el caption por defecto sin motivo.
export function buildStreakCaption(hastaFilterApplied: boolean): string {
  if (!hastaFilterApplied) {
    return "Semanas consecutivas con al menos una sesión, contando hacia atrás desde hoy.";
  }

  return (
    "Semanas consecutivas con al menos una sesión, contando hacia atrás desde hoy — " +
    'este cálculo ignora el filtro de fecha "hasta".'
  );
}
