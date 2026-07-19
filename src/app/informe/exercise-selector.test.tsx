import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { ExerciseSelector } from "./exercise-selector";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const pushMock = vi.fn();

const exercises = [
  { id: "1", name: "Sentadilla", type: "STRENGTH" as const },
  { id: "2", name: "Peso muerto", type: "STRENGTH" as const },
  { id: "3", name: "Carrera", type: "CARDIO" as const },
];

describe("ExerciseSelector", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockedUseRouter.mockReturnValue({
      push: pushMock,
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it("renderiza la opción 'Todos' y las opciones del catálogo agrupadas por tipo", () => {
    render(<ExerciseSelector exercises={exercises} selected="" />);

    expect(screen.getByRole("option", { name: /todos/i })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Sentadilla" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Peso muerto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carrera" })).toBeInTheDocument();
  });

  it("refleja el ejercicio seleccionado recibido por prop", () => {
    render(<ExerciseSelector exercises={exercises} selected="Carrera" />);

    expect(screen.getByRole("combobox")).toHaveValue("Carrera");
  });

  it("muestra 'Todos' seleccionado cuando no hay filtro activo", () => {
    render(<ExerciseSelector exercises={exercises} selected="" />);

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("navega a /informe con el ejercicio elegido al cambiar la selección", async () => {
    const user = userEvent.setup();
    render(<ExerciseSelector exercises={exercises} selected="" />);

    await user.selectOptions(screen.getByRole("combobox"), "Sentadilla");

    expect(pushMock).toHaveBeenCalledWith("/informe?ejercicio=Sentadilla");
  });

  it("navega a /informe sin query param al elegir 'Todos'", async () => {
    const user = userEvent.setup();
    render(<ExerciseSelector exercises={exercises} selected="Carrera" />);

    await user.selectOptions(screen.getByRole("combobox"), "");

    expect(pushMock).toHaveBeenCalledWith("/informe");
  });

  it("codifica nombres de ejercicio con caracteres especiales en la URL", async () => {
    const user = userEvent.setup();
    const exercisesWithSpecialChars = [
      { id: "4", name: "Press banca & remo", type: "STRENGTH" as const },
    ];
    render(
      <ExerciseSelector exercises={exercisesWithSpecialChars} selected="" />,
    );

    await user.selectOptions(
      screen.getByRole("combobox"),
      "Press banca & remo",
    );

    // Vía buildFilterUrl/URLSearchParams (BL-005): codifica igual que
    // encodeURIComponent salvo los espacios, como "+" en vez de "%20" —
    // ambas formas son válidas y equivalentes en una query string.
    expect(pushMock).toHaveBeenCalledWith(
      "/informe?ejercicio=Press+banca+%26+remo",
    );
  });

  it("preserva otros parámetros de la URL (p.ej. el rango de fechas) al cambiar de ejercicio", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "desde=2026-06-01&hasta=2026-06-30",
      ) as unknown as ReturnType<typeof useSearchParams>,
    );
    const user = userEvent.setup();
    render(<ExerciseSelector exercises={exercises} selected="" />);

    await user.selectOptions(screen.getByRole("combobox"), "Sentadilla");

    const lastUrl = pushMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split("?")[1]);
    expect(params.get("ejercicio")).toBe("Sentadilla");
    expect(params.get("desde")).toBe("2026-06-01");
    expect(params.get("hasta")).toBe("2026-06-30");
  });
});
