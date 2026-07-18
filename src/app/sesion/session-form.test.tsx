import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { SessionForm } from "./session-form";
import { generateSessionProposalAction } from "./actions";

const mockedGenerateSessionProposalAction = vi.mocked(
  generateSessionProposalAction,
);

vi.mock("./actions", () => ({
  registerSession: vi.fn(),
  generateSessionProposalAction: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const mockedUseActionState = vi.mocked(useActionState);

const exercises = [
  { id: "ex-1", name: "Sentadilla", type: "STRENGTH" as const },
  { id: "ex-2", name: "Carrera", type: "CARDIO" as const },
];

describe("SessionForm", () => {
  beforeEach(() => {
    mockedGenerateSessionProposalAction.mockReset();
  });

  it("renderiza el campo de fecha, el selector de ejercicios, el botón de IA y el botón de guardar", () => {
    render(<SessionForm exercises={exercises} />);

    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/añadir ejercicio/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generar propuesta con ia/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^guardar$/i }),
    ).toBeInTheDocument();
  });

  it("añade un bloque de fuerza con campos de serie al elegir un ejercicio de fuerza", async () => {
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.selectOptions(
      screen.getByLabelText(/añadir ejercicio/i),
      "Sentadilla",
    );
    await user.click(screen.getByRole("button", { name: /^añadir$/i }));

    expect(
      screen.getByRole("heading", { name: "Sentadilla" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^peso/i)).toBeInTheDocument();
  });

  it("añade un bloque de cardio con métricas opcionales al elegir un ejercicio de cardio", async () => {
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.selectOptions(
      screen.getByLabelText(/añadir ejercicio/i),
      "Carrera",
    );
    await user.click(screen.getByRole("button", { name: /^añadir$/i }));

    expect(
      screen.getByRole("heading", { name: "Carrera" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/duración/i)).toBeInTheDocument();
  });

  it("permite quitar un ejercicio ya añadido", async () => {
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.selectOptions(
      screen.getByLabelText(/añadir ejercicio/i),
      "Sentadilla",
    );
    await user.click(screen.getByRole("button", { name: /^añadir$/i }));
    expect(
      screen.getByRole("heading", { name: "Sentadilla" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /quitar ejercicio/i }));

    expect(
      screen.queryByRole("heading", { name: "Sentadilla" }),
    ).not.toBeInTheDocument();
  });

  it("permite añadir una serie adicional a un ejercicio de fuerza", async () => {
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.selectOptions(
      screen.getByLabelText(/añadir ejercicio/i),
      "Sentadilla",
    );
    await user.click(screen.getByRole("button", { name: /^añadir$/i }));
    await user.click(screen.getByRole("button", { name: /añadir serie/i }));

    expect(screen.getAllByLabelText(/reps/i)).toHaveLength(2);
  });

  it("muestra un mensaje de error cuando la acción devuelve un estado de error", () => {
    mockedUseActionState.mockReturnValueOnce([
      { error: "Revisa los ejercicios y la fecha introducidos." },
      vi.fn(),
      false,
    ]);

    render(<SessionForm exercises={exercises} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa los ejercicios y la fecha introducidos.",
    );
  });

  it("muestra un mensaje de éxito cuando la acción devuelve un estado de éxito", () => {
    mockedUseActionState.mockReturnValueOnce([
      { success: true },
      vi.fn(),
      false,
    ]);

    render(<SessionForm exercises={exercises} />);

    expect(screen.getByText(/sesión guardada/i)).toBeInTheDocument();
  });

  it("precarga el editor (editable) con la propuesta de IA cuando la generación tiene éxito", async () => {
    mockedGenerateSessionProposalAction.mockResolvedValue({
      success: true,
      fecha: "2026-01-15",
      registros: [
        {
          key: "registro-ia-1",
          tipo: "fuerza",
          ejercicio: "Sentadilla",
          notas: "",
          series: [{ reps: "10", peso_kg: "10", tempo: "", RPE: "7" }],
        },
      ],
    });
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.click(
      screen.getByRole("button", { name: /generar propuesta con ia/i }),
    );

    // Precargado pero editable: sigue siendo el mismo SessionEntriesEditor
    // (inputs normales), no un resumen de solo lectura.
    expect(
      await screen.findByRole("heading", { name: "Sentadilla" }),
    ).toBeInTheDocument();
    const repsInput = screen.getByLabelText(/reps/i);
    expect(repsInput).toHaveValue(10);
    await user.clear(repsInput);
    await user.type(repsInput, "12");
    expect(repsInput).toHaveValue(12);

    // El botón de guardar ya no está deshabilitado: hay ejercicios cargados.
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeEnabled();
  });

  it("muestra un aviso discreto y deja el formulario manual intacto cuando la generación falla", async () => {
    mockedGenerateSessionProposalAction.mockResolvedValue({
      success: false,
      message:
        "No se pudo generar la propuesta con IA. Puedes registrar la sesión manualmente.",
    });
    const user = userEvent.setup();
    render(<SessionForm exercises={exercises} />);

    await user.click(
      screen.getByRole("button", { name: /generar propuesta con ia/i }),
    );

    expect(
      await screen.findByText(/no se pudo generar la propuesta con ia/i),
    ).toBeInTheDocument();
    // El flujo manual sigue disponible tal cual: sin ejercicios precargados,
    // el botón de guardar sigue deshabilitado como antes de pulsar IA.
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeDisabled();
    expect(screen.getByLabelText(/añadir ejercicio/i)).toBeInTheDocument();
  });
});
