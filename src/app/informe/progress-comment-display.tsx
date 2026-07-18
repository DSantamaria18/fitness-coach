// Mismo patrón que progress-charts.tsx: formateador a nivel de módulo (no
// se recrea en cada render).
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Componente de solo mostrar texto: recibe `generadoEn` como string ISO en
// vez de objeto Date porque Next.js no cruza Date por la frontera
// server/client (ver DECISIONS.md).
export function ProgressCommentDisplay({
  texto,
  generadoEn,
}: {
  texto: string;
  generadoEn: string;
}) {
  const formattedDate = dateFormatter.format(new Date(generadoEn));

  return (
    <div className="rounded-md border border-black/10 px-4 py-3 dark:border-white/15">
      <p className="text-sm">{texto}</p>
      <p className="mt-2 text-xs text-black/60 dark:text-white/60">
        Generado el {formattedDate}
      </p>
    </div>
  );
}
