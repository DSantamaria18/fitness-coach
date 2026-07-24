// Conversores puros (sin JSX/hooks) entre el formato mm:ss que teclea/lee un
// corredor ("8:30") y los segundos totales que exige el contrato existente
// (Prisma `durationSeconds`/`avgPaceSecPerKm: Int?`, validate-session.ts).
// Un corredor real reportó que pensar "Duración (s)"/"Ritmo medio (s/km)" en
// segundos totales es confuso; el contrato interno no cambia, solo la capa
// de UI que lo teclea/muestra — ver DECISIONS.md.

export type ParseMinutesSecondsResult =
  | { success: true; seconds: number | undefined }
  | { success: false; error: string };

// Exactamente 2 dígitos de segundos (00-59): un mm:ss real no permite "8:75"
// ni "8:5". Los minutos aceptan 1-3 dígitos, con o sin cero a la izquierda
// ("5:30" y "05:30" son el mismo valor) para no obligar a teclear el cero.
const MM_SS_PATTERN = /^(\d{1,3}):([0-5]\d)$/;

export function parseMinutesSeconds(value: string): ParseMinutesSecondsResult {
  const trimmed = value.trim();

  // Cadena vacía = "campo no informado" (todas las métricas de cardio son
  // opcionales), no un error de formato — distinto de un valor presente
  // pero mal escrito, que sí debe informarse como error explícito en vez de
  // descartarse en silencio (el fallo mudo de toNumber() que motivó esto).
  if (trimmed === "") {
    return { success: true, seconds: undefined };
  }

  const match = MM_SS_PATTERN.exec(trimmed);
  if (!match) {
    return {
      success: false,
      error: `Formato inválido: usa minutos:segundos, ej. 8:30 (recibido "${value}")`,
    };
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return { success: true, seconds: minutes * 60 + seconds };
}

export function formatSecondsAsMinutesSeconds(totalSeconds: number): string {
  // Un valor negativo o no finito no debería llegar aquí en un flujo normal
  // (viene de BD o de un parseMinutesSeconds ya validado), pero se trata
  // como 0 en vez de propagar "NaN:NaN" o un signo que el propio formato
  // mm:ss no admite de vuelta.
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.trunc(totalSeconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
