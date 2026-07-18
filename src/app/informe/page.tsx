import type { Metadata } from "next";
import { auth } from "@/auth";
import { getProgressReport } from "@/lib/get-progress-report";
import { listExercises } from "@/lib/list-exercises";
import { getProgressComment } from "@/lib/progress-comment/get-progress-comment";
import { ExerciseSelector } from "./exercise-selector";
import { ProgressCharts, type ExerciseProgressData } from "./progress-charts";
import { ProgressComment } from "./progress-comment";

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
  searchParams: Promise<{ ejercicio?: string }>;
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

  const { ejercicio } = await searchParams;

  const [reportResult, exercises, progressComment] = await Promise.all([
    getProgressReport(userId, ejercicio ? { ejercicio } : {}),
    listExercises(),
    getProgressComment(userId),
  ]);

  // Un `ejercicio` en el query param que ya no existe en el catálogo
  // (p.ej. borrado tras compartir/guardar el enlace) no debe romper la
  // página: se ignora el filtro y se muestra el informe general en su
  // lugar, en vez de propagar el error al usuario.
  const report =
    reportResult.success || !ejercicio
      ? reportResult
      : await getProgressReport(userId, {});

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

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Informe de progreso</h1>

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
          // hoy (ver DECISIONS.md/BACKLOG.md): esta nota evita que
          // parezca un error si algún día no cuadra con lo esperado.
          caption="Semanas consecutivas con al menos una sesión, contando hacia atrás desde hoy."
        />
      </section>

      <ExerciseSelector
        exercises={exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          type: exercise.type,
        }))}
        // Si el filtro se ignoró (ejercicio inexistente en catálogo), el
        // selector vuelve a mostrar "Todos" en vez del valor obsoleto de
        // la URL.
        selected={data.exercise?.exercise ?? ""}
      />

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

      <ProgressCharts bodyWeight={bodyWeight} exercise={exerciseProgress} />
    </main>
  );
}
