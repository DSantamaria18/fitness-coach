"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type ProgressChartsProps = {
  bodyWeight: BodyWeightPoint[];
  exercise?: ExerciseProgressData;
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

function BodyWeightChart({ data }: { data: BodyWeightPoint[] }) {
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

function StrengthCharts({ points }: { points: StrengthProgressPoint[] }) {
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

function CardioCharts({ points }: { points: CardioProgressPoint[] }) {
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

export function ProgressCharts({ bodyWeight, exercise }: ProgressChartsProps) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Peso corporal</h2>
        <BodyWeightChart data={bodyWeight} />
      </section>

      {exercise ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            Progreso: {exercise.exercise}
          </h2>
          {exercise.type === "STRENGTH" ? (
            <StrengthCharts points={exercise.points} />
          ) : (
            <CardioCharts points={exercise.points} />
          )}
        </section>
      ) : null}
    </div>
  );
}
