"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonDatasetPoint } from "./align-comparison-series";

// Mismos tipos que get-progress-report.ts, pero con `date` como string ISO:
// no se cruza `Date` por la frontera server/client de Next (ver
// DECISIONS.md), así que page.tsx serializa antes de pasar los datos aquí.
export type BodyWeightPoint = { date: string; weightKg: number };

export type StrengthProgressPoint = {
  sessionId: string;
  date: string;
  maxWeightKg: number;
  totalVolumeKg: number;
};

export type CardioProgressPoint = {
  sessionId: string;
  date: string;
  distanceKm: number | null;
  durationSeconds: number | null;
  avgPaceSecPerKm: number | null;
};

export type ExerciseProgressData =
  | { exercise: string; type: "STRENGTH"; points: StrengthProgressPoint[] }
  | { exercise: string; type: "CARDIO"; points: CardioProgressPoint[] };

// BL-006: cuando la comparación de periodos está activa, cada métrica
// individual (peso corporal, o las del ejercicio filtrado) se sustituye por
// su comparativo de dos series en vez de elegir arbitrariamente una única
// "métrica principal" — un ejercicio de cardio tiene tres métricas y no hay
// un criterio no ambiguo para escoger solo una (ver DECISIONS.md).
export type ComparisonChartsData = {
  labels: { actual: string; anterior: string };
  bodyWeight?: ComparisonDatasetPoint[];
  exercise?:
    | {
        type: "STRENGTH";
        maxWeightKg: ComparisonDatasetPoint[];
        totalVolumeKg: ComparisonDatasetPoint[];
      }
    | {
        type: "CARDIO";
        distanceKm: ComparisonDatasetPoint[];
        durationSeconds: ComparisonDatasetPoint[];
        avgPaceSecPerKm: ComparisonDatasetPoint[];
      };
};

type ProgressChartsProps = {
  bodyWeight: BodyWeightPoint[];
  exercise?: ExerciseProgressData;
  comparison?: ComparisonChartsData;
};

// Colores del catálogo categórico validado del design system (ver skill
// dataviz, references/palette.md, orden 1=azul/2=verde/6=naranja): cada
// mini-gráfico de esta pantalla es de una sola serie con su propio eje, así
// que no hace falta comprobar separación CVD entre series adyacentes (no
// aparecen juntas) — se eligen tonos de alto contraste evitando los tres
// tonos claros del catálogo (magenta/amarillo/aqua) que quedan por debajo de
// 3:1 sobre superficie clara.
const SERIES_BLUE = "text-[#2a78d6] dark:text-[#3987e5]";
const SERIES_GREEN = "text-[#008300]";
const SERIES_ORANGE = "text-[#eb6834] dark:text-[#d95926]";

// ComparisonChart sí combina dos series en el mismo eje (decisión de
// producto ya cerrada por David, BL-006: gráfico superpuesto, no lado a
// lado). Reutiliza el mismo par azul/verde (slots 1/2 del catálogo) que ya
// conviven juntos en StrengthCharts (peso máximo/volumen) — es el par
// adyacente ya validado en references/palette.md (CVD ΔE 9.1 claro / 8.4
// oscuro), así que no hace falta re-validar. El verde no cambia entre modo
// claro/oscuro (mismo hex en la tabla), así que va como color literal; el
// azul sí, así que se define como variable CSS en el div contenedor (en vez
// del truco `currentColor` de SingleMetricChart, que solo sirve para UN
// color por gráfico): con dos líneas en el mismo `<svg>`, cada una necesita
// su propio color con soporte de modo oscuro, y la variable CSS la heredan
// tanto la línea como el swatch de la leyenda (`currentColor` por sí solo
// no resolvería igual en ambos, al no compartir el mismo nodo de origen).
const COMPARISON_ACTUAL_COLOR_VAR =
  "[--series-actual-color:#2a78d6] dark:[--series-actual-color:#3987e5]";
const COMPARISON_ANTERIOR_COLOR = "#008300";

const axisDateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
});

function formatAxisDate(iso: string) {
  return axisDateFormatter.format(new Date(iso));
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-black/60 dark:text-white/60">{children}</p>;
}

type MetricPoint = { date: string; value: number | null };

// Gráfico de una sola serie reutilizado por peso corporal, fuerza (peso
// máximo/volumen) y cardio (distancia/duración/ritmo): cada métrica vive en
// su propio eje Y en vez de combinarse en un único gráfico multi-serie,
// porque sus escalas son muy distintas entre sí (p.ej. peso máximo ~kg vs.
// volumen total ~cientos/miles de kg) — combinarlas aplastaría la serie más
// pequeña (ver skill dataviz: nunca combinar magnitudes de escala muy
// distinta en un único eje).
function SingleMetricChart({
  heading,
  emptyLabel,
  points,
  colorClassName,
}: {
  heading: string;
  emptyLabel: string;
  points: MetricPoint[];
  colorClassName: string;
}) {
  // Los campos de cardio son opcionales individualmente (SPEC.md §3: no
  // todos los relojes miden todo). Si ninguna sesión tiene el dato, un
  // gráfico vacío/plano confundiría más que ayudaría.
  const hasAnyValue = points.some((point) => point.value != null);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{heading}</h3>
      {hasAnyValue ? (
        <div className={`h-56 w-full ${colorClassName}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points.map((point) => ({
                label: formatAxisDate(point.date),
                value: point.value,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                domain={["auto", "auto"]}
                width={44}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                name={heading}
                stroke="currentColor"
                strokeWidth={2}
                dot={{ r: 3 }}
                // No conectar a través de huecos: un `null` es "no medido",
                // no "cero" (ver comentario de arriba sobre campos opcionales
                // de cardio) — dibujarlo como cero falsearía la gráfica.
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyMessage>Sin datos de {emptyLabel} registrados.</EmptyMessage>
      )}
    </div>
  );
}

// Gráfico superpuesto de dos series (BL-006, decisión de producto): mismo
// tipo de LineChart que SingleMetricChart, pero con `diaRelativo` en el eje
// X en vez de una fecha absoluta (así "día 1" del mes actual queda debajo
// de "día 1" del mes anterior) y una `<Line>` por periodo. `points` ya
// llega fusionado y con huecos explícitos desde alignComparisonSeries.
function ComparisonChart({
  heading,
  emptyLabel,
  points,
  labels,
}: {
  heading: string;
  emptyLabel: string;
  points: ComparisonDatasetPoint[];
  labels: { actual: string; anterior: string };
}) {
  const hasAnyValue = points.some(
    (point) => point.actual != null || point.anterior != null,
  );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{heading}</h3>
      {hasAnyValue ? (
        <div className={`h-64 w-full ${COMPARISON_ACTUAL_COLOR_VAR}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points.map((point) => ({
                label: `Día ${point.diaRelativo}`,
                actual: point.actual,
                anterior: point.anterior,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                domain={["auto", "auto"]}
                width={44}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                name={labels.actual}
                stroke="var(--series-actual-color)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="anterior"
                name={labels.anterior}
                stroke={COMPARISON_ANTERIOR_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyMessage>Sin datos de {emptyLabel} registrados.</EmptyMessage>
      )}
    </div>
  );
}

type ComparisonLabels = { actual: string; anterior: string };

function BodyWeightChart({
  data,
  comparison,
  comparisonLabels,
}: {
  data: BodyWeightPoint[];
  comparison?: ComparisonDatasetPoint[];
  comparisonLabels?: ComparisonLabels;
}) {
  // La comparación de periodos (BL-006) sustituye el gráfico simple aunque
  // el histórico completo (`data`) esté vacío: lo relevante es si hay datos
  // dentro de los dos periodos comparados, no en todo el histórico.
  if (comparison && comparisonLabels) {
    return (
      <ComparisonChart
        heading="Peso (kg)"
        emptyLabel="peso corporal"
        points={comparison}
        labels={comparisonLabels}
      />
    );
  }

  if (data.length === 0) {
    return (
      <EmptyMessage>Todavía no hay registros de peso corporal.</EmptyMessage>
    );
  }

  return (
    <SingleMetricChart
      heading="Peso (kg)"
      emptyLabel="peso corporal"
      points={data.map((point) => ({
        date: point.date,
        value: point.weightKg,
      }))}
      colorClassName={SERIES_BLUE}
    />
  );
}

function EmptyExerciseMessage() {
  return (
    <EmptyMessage>
      Todavía no hay registros de progreso para este ejercicio.
    </EmptyMessage>
  );
}

function StrengthCharts({
  points,
  comparison,
  comparisonLabels,
}: {
  points: StrengthProgressPoint[];
  comparison?: {
    maxWeightKg: ComparisonDatasetPoint[];
    totalVolumeKg: ComparisonDatasetPoint[];
  };
  comparisonLabels?: ComparisonLabels;
}) {
  if (comparison && comparisonLabels) {
    return (
      <div className="flex flex-col gap-6">
        <ComparisonChart
          heading="Peso máximo (kg)"
          emptyLabel="peso máximo"
          points={comparison.maxWeightKg}
          labels={comparisonLabels}
        />
        <ComparisonChart
          heading="Volumen total (kg)"
          emptyLabel="volumen total"
          points={comparison.totalVolumeKg}
          labels={comparisonLabels}
        />
      </div>
    );
  }

  if (points.length === 0) {
    return <EmptyExerciseMessage />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SingleMetricChart
        heading="Peso máximo (kg)"
        emptyLabel="peso máximo"
        points={points.map((point) => ({
          date: point.date,
          value: point.maxWeightKg,
        }))}
        colorClassName={SERIES_BLUE}
      />
      <SingleMetricChart
        heading="Volumen total (kg)"
        emptyLabel="volumen total"
        points={points.map((point) => ({
          date: point.date,
          value: point.totalVolumeKg,
        }))}
        colorClassName={SERIES_GREEN}
      />
    </div>
  );
}

function CardioCharts({
  points,
  comparison,
  comparisonLabels,
}: {
  points: CardioProgressPoint[];
  comparison?: {
    distanceKm: ComparisonDatasetPoint[];
    durationSeconds: ComparisonDatasetPoint[];
    avgPaceSecPerKm: ComparisonDatasetPoint[];
  };
  comparisonLabels?: ComparisonLabels;
}) {
  if (comparison && comparisonLabels) {
    return (
      <div className="flex flex-col gap-6">
        <ComparisonChart
          heading="Distancia (km)"
          emptyLabel="distancia"
          points={comparison.distanceKm}
          labels={comparisonLabels}
        />
        <ComparisonChart
          heading="Duración (s)"
          emptyLabel="duración"
          points={comparison.durationSeconds}
          labels={comparisonLabels}
        />
        <ComparisonChart
          heading="Ritmo medio (s/km)"
          emptyLabel="ritmo medio"
          points={comparison.avgPaceSecPerKm}
          labels={comparisonLabels}
        />
      </div>
    );
  }

  if (points.length === 0) {
    return <EmptyExerciseMessage />;
  }

  return (
    <div className="flex flex-col gap-6">
      <SingleMetricChart
        heading="Distancia (km)"
        emptyLabel="distancia"
        points={points.map((point) => ({
          date: point.date,
          value: point.distanceKm,
        }))}
        colorClassName={SERIES_BLUE}
      />
      <SingleMetricChart
        heading="Duración (s)"
        emptyLabel="duración"
        points={points.map((point) => ({
          date: point.date,
          value: point.durationSeconds,
        }))}
        colorClassName={SERIES_GREEN}
      />
      <SingleMetricChart
        heading="Ritmo medio (s/km)"
        emptyLabel="ritmo medio"
        points={points.map((point) => ({
          date: point.date,
          value: point.avgPaceSecPerKm,
        }))}
        colorClassName={SERIES_ORANGE}
      />
    </div>
  );
}

export function ProgressCharts({
  bodyWeight,
  exercise,
  comparison,
}: ProgressChartsProps) {
  // `comparison.exercise` solo se usa si su tipo coincide con el ejercicio
  // filtrado — no debería divergir en la práctica (page.tsx los deriva del
  // mismo `data.exercise` resuelto), pero de romperse esa invariante es más
  // seguro ignorar la comparación de esa sección que mostrar series de un
  // tipo de ejercicio distinto al que dice el encabezado.
  const strengthComparison =
    comparison?.exercise?.type === "STRENGTH" ? comparison.exercise : undefined;
  const cardioComparison =
    comparison?.exercise?.type === "CARDIO" ? comparison.exercise : undefined;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Peso corporal</h2>
        <BodyWeightChart
          data={bodyWeight}
          comparison={comparison?.bodyWeight}
          comparisonLabels={comparison?.labels}
        />
      </section>

      {exercise ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            Progreso: {exercise.exercise}
          </h2>
          {exercise.type === "STRENGTH" ? (
            <StrengthCharts
              points={exercise.points}
              comparison={strengthComparison}
              comparisonLabels={comparison?.labels}
            />
          ) : (
            <CardioCharts
              points={exercise.points}
              comparison={cardioComparison}
              comparisonLabels={comparison?.labels}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
