import type { Metadata } from "next";
import { auth } from "@/auth";
import { getProgressReport } from "@/lib/get-progress-report";
import { listExercises } from "@/lib/list-exercises";
import { getProgressComment } from "@/lib/progress-comment/get-progress-comment";
import { alignComparisonSeries } from "./align-comparison-series";
import { ComparisonPeriodSelector } from "./comparison-period-selector";
import {
  computeComparisonPeriods,
  parseComparisonPreset,
  type ComparisonPeriods,
} from "./comparison-periods";
import { DateRangeFilter } from "./date-range-filter";
import { ExerciseSelector } from "./exercise-selector";
import { ExportImageButton } from "./export-image-button";
import { parseDateRangeSearchParams } from "./parse-date-range";
import {
  ProgressCharts,
  type ComparisonChartsData,
  type ExerciseProgressData,
} from "./progress-charts";
import { ProgressComment } from "./progress-comment";
import { buildStreakCaption } from "./streak-caption";

// Reduce la duplicación de "serializar puntos a MetricPoint + fusionar por
// día relativo" a una sola línea por métrica (BL-006): todos los puntos de
// getProgressReport comparten forma `{ date: Date, ... }`, solo cambia qué
// campo se usa como `value`.
function buildMetricComparison<T extends { date: Date }>(
  actualPoints: T[],
  anteriorPoints: T[],
  periods: ComparisonPeriods,
  valueOf: (point: T) => number | null,
) {
  const toMetricPoints = (points: T[]) =>
    points.map((point) => ({
      date: point.date.toISOString(),
      value: valueOf(point),
    }));

  return alignComparisonSeries({
    actual: {
      points: toMetricPoints(actualPoints),
      periodStart: periods.actual.desde,
    },
    anterior: {
      points: toMetricPoints(anteriorPoints),
      periodStart: periods.anterior.desde,
    },
  });
}

export const metadata: Metadata = {
  title: "Informe de progreso — Fitness Coach",
};

function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-black/10 px-4 py-3 dark:border-white/15">
      <span className="text-xs text-black/60 dark:text-white/60">{label}</span>
      <span className="text-xl font-semibold">{value}</span>
      {caption ? (
        <span className="text-xs text-black/50 dark:text-white/50">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export default async function InformePage({
  searchParams,
}: {
  // Next 16 App Router: searchParams es una Promise (ver DECISIONS.md/
  // convenciones ya usadas en el resto de la app).
  searchParams: Promise<{
    ejercicio?: string;
    desde?: string;
    hasta?: string;
    comparar?: string;
  }>;
}) {
  // Server Component: llama a la capa de dominio directamente (sin pasar
  // por HTTP), mismo patrón que /historial. src/proxy.ts ya exige sesión
  // para llegar aquí, pero se comprueba de nuevo porque la capa de dominio
  // nunca debe asumir un userId no nulo.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const {
    ejercicio,
    desde: desdeRaw,
    hasta: hastaRaw,
    comparar: compararRaw,
  } = await searchParams;
  // Los límites de fecha crudos de la URL (formato de <input type="date">)
  // se validan y convierten aquí, antes de llegar a getProgressReport (que
  // espera ISO datetime completo) — nunca se pasa el string sin parsear
  // (CLAUDE.md regla 7).
  const dateRange = parseDateRangeSearchParams({
    desde: desdeRaw,
    hasta: hastaRaw,
  });
  const comparisonPreset = parseComparisonPreset(compararRaw);

  // La comparación de periodos (BL-006) y el rango manual (BL-005) son
  // mutuamente excluyentes (decisión de producto): si `comparar` es válido,
  // se ignora cualquier desde/hasta que hubiera quedado en la URL en vez de
  // combinarlos con un resultado ambiguo de cuál manda. La UI ya evita que
  // ambos coexistan (ComparisonPeriodSelector/DateRangeFilter se borran
  // mutuamente al cambiar), esto es la defensa server-side para una URL
  // editada a mano.
  const effectiveDateFilters = comparisonPreset ? {} : dateRange.filters;

  const filters = {
    ...(ejercicio ? { ejercicio } : {}),
    ...effectiveDateFilters,
  };
  const hasFilters = Object.keys(filters).length > 0;

  const [reportResult, exercises, progressComment] = await Promise.all([
    getProgressReport(userId, filters),
    listExercises(),
    getProgressComment(userId),
  ]);

  // Un filtro inválido a nivel de dominio (ejercicio que ya no existe en el
  // catálogo, o un rango desde/hasta invertido colado por una URL editada a
  // mano — el formato ya se validó arriba) no debe romper la página: se
  // ignoran todos los filtros y se muestra el informe general, en vez de
  // propagar el error al usuario.
  const usedFallback = !reportResult.success && hasFilters;
  const report = usedFallback
    ? await getProgressReport(userId, {})
    : reportResult;

  if (!report.success) {
    return (
      <main className="flex flex-1 flex-col gap-8 p-6">
        <h1 className="text-xl font-semibold">Informe de progreso</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          No se ha podido generar el informe. Inténtalo de nuevo más tarde.
        </p>
      </main>
    );
  }

  const { data } = report;

  // No se cruza `Date` por la frontera server/client (ver DECISIONS.md):
  // todo lo que llega a ProgressCharts va como string ISO.
  const bodyWeight = data.bodyWeight.map((point) => ({
    date: point.date.toISOString(),
    weightKg: point.weightKg,
  }));

  const exerciseProgress: ExerciseProgressData | undefined = data.exercise
    ? data.exercise.type === "STRENGTH"
      ? {
          exercise: data.exercise.exercise,
          type: "STRENGTH",
          points: data.exercise.points.map((point) => ({
            sessionId: point.sessionId,
            date: point.date.toISOString(),
            maxWeightKg: point.maxWeightKg,
            totalVolumeKg: point.totalVolumeKg,
          })),
        }
      : {
          exercise: data.exercise.exercise,
          type: "CARDIO",
          points: data.exercise.points.map((point) => ({
            sessionId: point.sessionId,
            date: point.date.toISOString(),
            distanceKm: point.distanceKm,
            durationSeconds: point.durationSeconds,
            avgPaceSecPerKm: point.avgPaceSecPerKm,
          })),
        }
    : undefined;

  const { frequency } = data;

  // BL-006: la comparación se calcula con dos llamadas extra a
  // getProgressReport (periodo actual y anterior), usando el ejercicio ya
  // resuelto por el informe general (`data.exercise`, tras cualquier
  // fallback) en vez del `ejercicio` crudo de la URL — así nunca puede dar
  // NOT_FOUND aquí, ese caso ya se resolvió arriba. Si por cualquier otro
  // motivo alguna de las dos llamadas falla, se ignora la comparación en
  // vez de romper la página: el usuario sigue viendo el informe general
  // (mismo criterio de "degradar sin romper" que el resto de filtros).
  let comparison: ComparisonChartsData | undefined;
  if (comparisonPreset) {
    const periods = computeComparisonPeriods(comparisonPreset, new Date());
    const comparisonExercise = data.exercise?.exercise;
    const comparisonFilters = comparisonExercise
      ? { ejercicio: comparisonExercise }
      : {};

    const [actualResult, anteriorResult] = await Promise.all([
      getProgressReport(userId, { ...comparisonFilters, ...periods.actual }),
      getProgressReport(userId, {
        ...comparisonFilters,
        ...periods.anterior,
      }),
    ]);

    if (actualResult.success && anteriorResult.success) {
      const labels =
        comparisonPreset === "mes"
          ? { actual: "Este mes", anterior: "Mes anterior" }
          : { actual: "Este año", anterior: "Año anterior" };
      const actualExercise = actualResult.data.exercise;
      const anteriorExercise = anteriorResult.data.exercise;

      if (
        data.exercise?.type === "STRENGTH" &&
        actualExercise?.type === "STRENGTH" &&
        anteriorExercise?.type === "STRENGTH"
      ) {
        comparison = {
          labels,
          exercise: {
            type: "STRENGTH",
            maxWeightKg: buildMetricComparison(
              actualExercise.points,
              anteriorExercise.points,
              periods,
              (point) => point.maxWeightKg,
            ),
            totalVolumeKg: buildMetricComparison(
              actualExercise.points,
              anteriorExercise.points,
              periods,
              (point) => point.totalVolumeKg,
            ),
          },
        };
      } else if (
        data.exercise?.type === "CARDIO" &&
        actualExercise?.type === "CARDIO" &&
        anteriorExercise?.type === "CARDIO"
      ) {
        comparison = {
          labels,
          exercise: {
            type: "CARDIO",
            distanceKm: buildMetricComparison(
              actualExercise.points,
              anteriorExercise.points,
              periods,
              (point) => point.distanceKm,
            ),
            durationSeconds: buildMetricComparison(
              actualExercise.points,
              anteriorExercise.points,
              periods,
              (point) => point.durationSeconds,
            ),
            avgPaceSecPerKm: buildMetricComparison(
              actualExercise.points,
              anteriorExercise.points,
              periods,
              (point) => point.avgPaceSecPerKm,
            ),
          },
        };
      } else if (!data.exercise) {
        comparison = {
          labels,
          bodyWeight: buildMetricComparison(
            actualResult.data.bodyWeight,
            anteriorResult.data.bodyWeight,
            periods,
            (point) => point.weightKg,
          ),
        };
      }
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Informe de progreso</h1>
        <ExportImageButton />
      </div>

      {/* Contenedor capturado por ExportImageButton (BL-007): incluye
          exactamente el alcance de producto (estadísticas, controles de
          filtro y gráficos, con la comparación de periodos si está activa).
          Deja fuera el título y el propio botón de exportación: no forman
          parte del "informe" en sí, y el botón además cambia de aspecto
          ("Generando...") justo mientras se captura la imagen si se
          incluyera. Ver ARCHITECTURE.md. */}
      <div id="informe-content" className="flex flex-col gap-8">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Sesiones totales"
            value={frequency.totalSessions.toLocaleString("es-ES")}
          />
          <StatCard
            label="Sesiones / semana"
            value={frequency.sessionsPerWeek.toLocaleString("es-ES")}
          />
          <StatCard
            label="Racha actual"
            value={`${frequency.currentStreakWeeks} ${
              frequency.currentStreakWeeks === 1 ? "semana" : "semanas"
            }`}
            // La racha se calcula siempre respecto a la semana ISO real de
            // hoy, ignorando el filtro `hasta` (ver DECISIONS.md/BACKLOG.md):
            // con el filtro de rango de fechas ya disponible (BL-005), el
            // caption lo explicita cuando `hasta` está realmente aplicado,
            // para que un rango en el pasado no parezca un error al mostrar
            // racha 0.
            caption={buildStreakCaption(
              !usedFallback && Boolean(effectiveDateFilters.hasta),
            )}
          />
        </section>

        <ExerciseSelector
          exercises={exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            type: exercise.type,
          }))}
          // Si el filtro se ignoró (ejercicio inexistente en catálogo, o el
          // fallback se disparó por otro filtro inválido), el selector vuelve
          // a mostrar "Todos" en vez del valor obsoleto de la URL.
          selected={data.exercise?.exercise ?? ""}
        />

        <DateRangeFilter
          // Mismo criterio que ExerciseSelector: si el fallback se disparó, o
          // si la comparación de periodos está activa (mutuamente excluyente
          // con el rango manual, BL-006), los inputs vuelven a mostrarse
          // vacíos en vez del valor obsoleto de la URL.
          desde={usedFallback || comparisonPreset ? "" : dateRange.raw.desde}
          hasta={usedFallback || comparisonPreset ? "" : dateRange.raw.hasta}
        />

        <ComparisonPeriodSelector selected={comparisonPreset ?? ""} />

        <ProgressComment
          initial={
            progressComment
              ? {
                  texto: progressComment.texto,
                  generadoEn: progressComment.generadoEn.toISOString(),
                }
              : null
          }
        />

        <ProgressCharts
          bodyWeight={bodyWeight}
          exercise={exerciseProgress}
          comparison={comparison}
        />
      </div>
    </main>
  );
}
