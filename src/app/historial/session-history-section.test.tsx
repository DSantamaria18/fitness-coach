import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { SessionHistorySection } from "./session-history-section";
import { deleteSessionEntry } from "./actions";

vi.mock("./actions", () => ({
  updateSessionEntry: vi.fn(),
  deleteSessionEntry: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const mockedUseActionState = vi.mocked(useActionState);
const deleteSessionEntryMock = vi.mocked(deleteSessionEntry);

const exercises = [
  { id: "ex-1", name: "Sentadilla", type: "STRENGTH" as const },
  { id: "ex-2", name: "Carrera", type: "CARDIO" as const },
];

const strengthSession = {
  id: "s-1",
  date: "2026-07-01T00:00:00.000Z",
  ejercicios: [
    {
      tipo: "fuerza" as const,
      ejercicio: "Sentadilla",
      series: [
        { reps: 5, peso_kg: 100, tempo: null, RPE: 8 },
        { reps: 5, peso_kg: 105, tempo: null, RPE: null },
      ],
    },
  ],
};

const cardioSession = {
  id: "s-2",
  date: "2026-06-15T00:00:00.000Z",
  ejercicios: [
    {
      tipo: "cardio" as const,
      ejercicio: "Carrera",
      duracion: 1800,
      distancia_km: 5,
      velocidad_media: null,
      ritmo_medio: null,
      frecuencia_cardiaca_media: null,
      frecuencia_cardiaca_maxima: null,
      pasos: null,
      frecuencia_paso: null,
      kcal: null,
      RPE: null,
    },
  ],
};

describe("SessionHistorySection", () => {
  beforeEach(() => {
    deleteSessionEntryMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("muestra un mensaje cuando no hay sesiones", () => {
    render(<SessionHistorySection entries={[]} exercises={exercises} />);

    expect(
      screen.getByText(/todavía no hay sesiones registradas/i),
    ).toBeInTheDocument();
  });

  it("lista una sesión de fuerza con la fecha y el resumen de sus series", () => {
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    expect(screen.getByText("01/07/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Sentadilla", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/5×100kg · RPE 8, 5×105kg/)).toBeInTheDocument();
  });

  // Ejercicios a peso corporal (Burpees, Dominadas...) guardan peso_kg null
  // (ver DECISIONS.md): el listado de solo lectura no debe mostrar un "0kg"
  // falso ni "nullkg" literal.
  it("muestra una serie sin peso (peso corporal) sin inventar un número", () => {
    const bodyweightSession = {
      id: "s-3",
      date: "2026-07-05T00:00:00.000Z",
      ejercicios: [
        {
          tipo: "fuerza" as const,
          ejercicio: "Burpees",
          series: [{ reps: 12, peso_kg: null, tempo: null, RPE: null }],
        },
      ],
    };

    render(
      <SessionHistorySection
        entries={[bodyweightSession]}
        exercises={exercises}
      />,
    );

    expect(screen.getByText(/12 reps \(peso corporal\)/)).toBeInTheDocument();
  });

  it("lista una sesión de cardio con la fecha y las métricas rellenas", () => {
    render(
      <SessionHistorySection entries={[cardioSession]} exercises={exercises} />,
    );

    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
    expect(
      screen.getByText(/Duración \(s\): 1800 · Distancia \(km\): 5/),
    ).toBeInTheDocument();
  });

  it("muestra el formulario de edición prefilled al pulsar Editar en una sesión de fuerza", async () => {
    const user = userEvent.setup();
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    await user.click(screen.getByRole("button", { name: /editar/i }));

    expect(
      screen.getByRole("heading", { name: "Sentadilla" }),
    ).toBeInTheDocument();
    const repsInputs = screen.getAllByLabelText(/reps/i) as HTMLInputElement[];
    expect(repsInputs).toHaveLength(2);
    expect(repsInputs[0].value).toBe("5");
    const pesoInputs = screen.getAllByLabelText(/^peso/i) as HTMLInputElement[];
    expect(pesoInputs[0].value).toBe("100");
    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-07-01");

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(
      screen.queryByRole("heading", { name: "Sentadilla" }),
    ).not.toBeInTheDocument();
  });

  it("muestra el formulario de edición prefilled al pulsar Editar en una sesión de cardio", async () => {
    const user = userEvent.setup();
    render(
      <SessionHistorySection entries={[cardioSession]} exercises={exercises} />,
    );

    await user.click(screen.getByRole("button", { name: /editar/i }));

    expect(
      screen.getByRole("heading", { name: "Carrera" }),
    ).toBeInTheDocument();
    const duracionInput = screen.getByLabelText(
      /duración/i,
    ) as HTMLInputElement;
    expect(duracionInput.value).toBe("1800");
  });

  it("muestra el error de la Server Action en el formulario de edición", async () => {
    mockedUseActionState.mockReturnValueOnce([
      { error: "Revisa los ejercicios y la fecha introducidos." },
      vi.fn(),
      false,
    ]);
    const user = userEvent.setup();
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    await user.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa los ejercicios y la fecha introducidos.",
    );
  });

  it("pide confirmación antes de borrar y no llama a deleteSessionEntry si se cancela", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    await user.click(screen.getByRole("button", { name: /borrar/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteSessionEntryMock).not.toHaveBeenCalled();
  });

  it("llama a deleteSessionEntry con el id de la sesión cuando se confirma el borrado", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteSessionEntryMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    await user.click(screen.getByRole("button", { name: /borrar/i }));

    expect(deleteSessionEntryMock).toHaveBeenCalledWith("s-1");
  });

  it("muestra un mensaje de error si el borrado confirmado falla", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteSessionEntryMock.mockResolvedValue({
      error: "Sesión no encontrada.",
    });
    const user = userEvent.setup();
    render(
      <SessionHistorySection
        entries={[strengthSession]}
        exercises={exercises}
      />,
    );

    await user.click(screen.getByRole("button", { name: /borrar/i }));

    expect(
      await screen.findByText("Sesión no encontrada."),
    ).toBeInTheDocument();
  });

  it("permite listar y editar varias sesiones sin mezclar sus filas", () => {
    render(
      <SessionHistorySection
        entries={[strengthSession, cardioSession]}
        exercises={exercises}
      />,
    );

    expect(screen.getAllByRole("button", { name: /editar/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /borrar/i })).toHaveLength(2);
  });
});
