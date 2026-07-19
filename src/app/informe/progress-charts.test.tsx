import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressCharts } from "./progress-charts";

describe("ProgressCharts", () => {
  describe("peso corporal", () => {
    it("muestra un mensaje cuando no hay registros de peso", () => {
      render(<ProgressCharts bodyWeight={[]} />);

      expect(
        screen.getByText(/todavía no hay registros de peso/i),
      ).toBeInTheDocument();
    });

    it("renderiza el gráfico cuando hay registros de peso", () => {
      const { container } = render(
        <ProgressCharts
          bodyWeight={[
            { date: "2026-07-01T00:00:00.000Z", weightKg: 80 },
            { date: "2026-07-08T00:00:00.000Z", weightKg: 79.5 },
          ]}
        />,
      );

      expect(
        screen.queryByText(/todavía no hay registros de peso/i),
      ).not.toBeInTheDocument();
      expect(container.querySelector("svg")).toBeTruthy();
    });
  });

  describe("sin filtro de ejercicio", () => {
    it("no renderiza ninguna sección de ejercicio si no se pasa la prop", () => {
      render(<ProgressCharts bodyWeight={[]} />);

      expect(
        screen.queryByText(/todavía no hay registros de progreso/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("ejercicio de fuerza", () => {
    it("muestra un mensaje cuando el ejercicio no tiene puntos registrados", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{ exercise: "Sentadilla", type: "STRENGTH", points: [] }}
        />,
      );

      expect(
        screen.getByText(/todavía no hay registros de progreso/i),
      ).toBeInTheDocument();
    });

    it("muestra las dos series (peso máximo y volumen total) cuando hay datos", () => {
      const { container } = render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{
            exercise: "Sentadilla",
            type: "STRENGTH",
            points: [
              {
                sessionId: "s1",
                date: "2026-07-01T00:00:00.000Z",
                maxWeightKg: 80,
                totalVolumeKg: 2400,
              },
              {
                sessionId: "s2",
                date: "2026-07-08T00:00:00.000Z",
                maxWeightKg: 82.5,
                totalVolumeKg: 2500,
              },
            ],
          }}
        />,
      );

      expect(screen.getByText(/peso máximo/i)).toBeInTheDocument();
      expect(screen.getByText(/volumen total/i)).toBeInTheDocument();
      expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(
        2,
      );
    });
  });

  describe("ejercicio de cardio", () => {
    it("no rompe cuando hay campos individuales null mezclados", () => {
      expect(() =>
        render(
          <ProgressCharts
            bodyWeight={[]}
            exercise={{
              exercise: "Carrera",
              type: "CARDIO",
              points: [
                {
                  sessionId: "s1",
                  date: "2026-07-01T00:00:00.000Z",
                  distanceKm: 5,
                  durationSeconds: null,
                  avgPaceSecPerKm: null,
                },
                {
                  sessionId: "s2",
                  date: "2026-07-08T00:00:00.000Z",
                  distanceKm: null,
                  durationSeconds: 1800,
                  avgPaceSecPerKm: 300,
                },
              ],
            }}
          />,
        ),
      ).not.toThrow();

      expect(screen.getByText(/distancia/i)).toBeInTheDocument();
      expect(screen.getByText(/duración/i)).toBeInTheDocument();
      expect(screen.getByText(/ritmo medio/i)).toBeInTheDocument();
    });

    it("avisa cuando ninguna sesión tiene datos de un campo concreto", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{
            exercise: "Carrera",
            type: "CARDIO",
            points: [
              {
                sessionId: "s1",
                date: "2026-07-01T00:00:00.000Z",
                distanceKm: 5,
                durationSeconds: null,
                avgPaceSecPerKm: null,
              },
            ],
          }}
        />,
      );

      expect(
        screen.getByText(/sin datos de duración registrados/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/sin datos de ritmo medio registrados/i),
      ).toBeInTheDocument();
    });

    it("muestra un mensaje cuando el ejercicio de cardio no tiene puntos registrados", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{ exercise: "Carrera", type: "CARDIO", points: [] }}
        />,
      );

      expect(
        screen.getByText(/todavía no hay registros de progreso/i),
      ).toBeInTheDocument();
    });
  });

  describe("comparación de periodos (BL-006)", () => {
    it("con `comparison.bodyWeight`, sustituye el gráfico simple de peso por el comparativo con las dos series", () => {
      render(
        <ProgressCharts
          bodyWeight={[{ date: "2026-07-01T00:00:00.000Z", weightKg: 80 }]}
          comparison={{
            labels: { actual: "Este mes", anterior: "Mes anterior" },
            bodyWeight: [
              { diaRelativo: 1, actual: 80, anterior: 79 },
              { diaRelativo: 2, actual: null, anterior: 78.5 },
            ],
          }}
        />,
      );

      expect(screen.getByText("Este mes")).toBeInTheDocument();
      expect(screen.getByText("Mes anterior")).toBeInTheDocument();
    });

    it("muestra un aviso de sin datos cuando ningún periodo tiene valores de peso", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          comparison={{
            labels: { actual: "Este mes", anterior: "Mes anterior" },
            bodyWeight: [{ diaRelativo: 1, actual: null, anterior: null }],
          }}
        />,
      );

      expect(
        screen.getByText(/sin datos de peso corporal registrados/i),
      ).toBeInTheDocument();
    });

    it("con `comparison.exercise` de fuerza, sustituye las dos series de fuerza por sus comparativos", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{
            exercise: "Sentadilla",
            type: "STRENGTH",
            points: [
              {
                sessionId: "s1",
                date: "2026-07-01T00:00:00.000Z",
                maxWeightKg: 80,
                totalVolumeKg: 2400,
              },
            ],
          }}
          comparison={{
            labels: { actual: "Este año", anterior: "Año anterior" },
            exercise: {
              type: "STRENGTH",
              maxWeightKg: [{ diaRelativo: 1, actual: 80, anterior: 77.5 }],
              totalVolumeKg: [{ diaRelativo: 1, actual: 2400, anterior: 2300 }],
            },
          }}
        />,
      );

      expect(screen.getAllByText("Este año")).toHaveLength(2);
      expect(screen.getAllByText("Año anterior")).toHaveLength(2);
    });

    it("con `comparison.exercise` de cardio, sustituye las tres series de cardio por sus comparativos", () => {
      render(
        <ProgressCharts
          bodyWeight={[]}
          exercise={{
            exercise: "Carrera",
            type: "CARDIO",
            points: [
              {
                sessionId: "s1",
                date: "2026-07-01T00:00:00.000Z",
                distanceKm: 5,
                durationSeconds: 1800,
                avgPaceSecPerKm: 300,
              },
            ],
          }}
          comparison={{
            labels: { actual: "Este mes", anterior: "Mes anterior" },
            exercise: {
              type: "CARDIO",
              distanceKm: [{ diaRelativo: 1, actual: 5, anterior: 4.5 }],
              durationSeconds: [
                { diaRelativo: 1, actual: 1800, anterior: 1700 },
              ],
              avgPaceSecPerKm: [{ diaRelativo: 1, actual: 300, anterior: 310 }],
            },
          }}
        />,
      );

      expect(screen.getAllByText("Este mes")).toHaveLength(3);
      expect(screen.getAllByText("Mes anterior")).toHaveLength(3);
    });
  });
});
