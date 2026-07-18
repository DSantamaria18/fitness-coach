import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { SessionForm } from "./session-form";

vi.mock("./actions", () => ({
  registerSession: vi.fn(),
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
  it("renderiza el campo de fecha, el selector de ejercicios y el botón de guardar", () => {
    render(<SessionForm exercises={exercises} />);

    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/añadir ejercicio/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar/i }),
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
});
