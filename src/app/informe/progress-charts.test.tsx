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
});
