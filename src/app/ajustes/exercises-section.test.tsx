import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExercisesSection } from "./exercises-section";
import {
  createExerciseAction,
  deleteExerciseAction,
  renameExerciseAction,
} from "./actions";

vi.mock("./actions", () => ({
  createExerciseAction: vi.fn(),
  renameExerciseAction: vi.fn(),
  deleteExerciseAction: vi.fn(),
}));

const createExerciseActionMock = vi.mocked(createExerciseAction);
const renameExerciseActionMock = vi.mocked(renameExerciseAction);
const deleteExerciseActionMock = vi.mocked(deleteExerciseAction);

const exercises = [
  { id: "ex-1", name: "Sentadilla", type: "STRENGTH" as const },
  { id: "ex-2", name: "Press banca", type: "STRENGTH" as const },
  { id: "ex-3", name: "Bicicleta", type: "CARDIO" as const },
];

describe("ExercisesSection", () => {
  beforeEach(() => {
    createExerciseActionMock.mockReset();
    renameExerciseActionMock.mockReset();
    deleteExerciseActionMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("muestra un mensaje cuando el catálogo está vacío", () => {
    render(<ExercisesSection exercises={[]} />);

    expect(screen.getByText(/todavía no hay ejercicios/i)).toBeInTheDocument();
  });

  it("lista cada ejercicio agrupado por tipo, con acciones de editar/borrar", () => {
    render(<ExercisesSection exercises={exercises} />);

    expect(screen.getByRole("heading", { name: "Fuerza" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cardio" })).toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
    expect(screen.getByText("Press banca")).toBeInTheDocument();
    expect(screen.getByText("Bicicleta")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Borrar" })).toHaveLength(3);
  });

  it("crea un ejercicio nuevo y limpia el formulario tras el éxito", async () => {
    createExerciseActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const nameInput = screen.getByLabelText(/nombre/i) as HTMLInputElement;
    await user.type(nameInput, "Surf");
    await user.selectOptions(screen.getByLabelText(/tipo/i), "CARDIO");
    await user.click(screen.getByRole("button", { name: /añadir ejercicio/i }));

    expect(await screen.findByText(/ejercicio añadido/i)).toBeInTheDocument();
    expect(createExerciseActionMock).toHaveBeenCalled();
    const formData = createExerciseActionMock.mock.calls[0]![1];
    expect(formData.get("name")).toBe("Surf");
    expect(formData.get("type")).toBe("CARDIO");
    expect(nameInput.value).toBe("");
  });

  it("muestra el error del alta cuando el nombre ya existe", async () => {
    createExerciseActionMock.mockResolvedValue({
      error: "Ya existe un ejercicio con ese nombre.",
    });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    await user.type(screen.getByLabelText(/nombre/i), "Sentadilla");
    await user.click(screen.getByRole("button", { name: /añadir ejercicio/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe un ejercicio con ese nombre.",
    );
  });

  it("muestra el formulario de edición prefilled al pulsar Editar, y vuelve a la lista al pulsar Cancelar", async () => {
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Editar" }));

    const nameInput = within(row!).getByLabelText(
      /nombre/i,
    ) as HTMLInputElement;
    const typeSelect = within(row!).getByLabelText(
      /tipo/i,
    ) as HTMLSelectElement;
    expect(nameInput.value).toBe("Sentadilla");
    expect(typeSelect.value).toBe("STRENGTH");

    await user.click(within(row!).getByRole("button", { name: /cancelar/i }));

    expect(within(row!).queryByLabelText(/nombre/i)).not.toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
  });

  it("llama a renameExerciseAction con el id del ejercicio al guardar la edición", async () => {
    renameExerciseActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Editar" }));

    const nameInput = within(row!).getByLabelText(/nombre/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Sentadilla trasera");
    await user.click(within(row!).getByRole("button", { name: /guardar/i }));

    expect(renameExerciseActionMock).toHaveBeenCalledWith(
      "ex-1",
      undefined,
      expect.any(FormData),
    );
    const formData = renameExerciseActionMock.mock.calls[0]![2];
    expect(formData.get("name")).toBe("Sentadilla trasera");
  });

  it("muestra el error de la Server Action en el formulario de edición", async () => {
    // A diferencia de WeightHistorySection (un único useActionState montado
    // a la vez), aquí ExerciseCreateForm ya tiene el suyo propio siempre
    // montado, así que un mockReturnValueOnce global sobre useActionState
    // lo capturaría el formulario de alta en vez del de edición. Se
    // verifica en su lugar a través del flujo real de envío.
    renameExerciseActionMock.mockResolvedValue({
      error: "Ya existe un ejercicio con ese nombre.",
    });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Editar" }));
    await user.click(within(row!).getByRole("button", { name: /guardar/i }));

    expect(await within(row!).findByRole("alert")).toHaveTextContent(
      "Ya existe un ejercicio con ese nombre.",
    );
  });

  it("pide confirmación antes de borrar y no llama a deleteExerciseAction si se cancela", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Borrar" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteExerciseActionMock).not.toHaveBeenCalled();
  });

  it("llama a deleteExerciseAction con el id cuando se confirma el borrado", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteExerciseActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Borrar" }));

    expect(deleteExerciseActionMock).toHaveBeenCalledWith("ex-1");
  });

  it("muestra el error IN_USE cuando el borrado está bloqueado, sin quitar el ejercicio de la lista", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteExerciseActionMock.mockResolvedValue({
      error: "No se puede eliminar: ya tiene sesiones registradas.",
    });
    const user = userEvent.setup();
    render(<ExercisesSection exercises={exercises} />);

    const row = screen.getByText("Sentadilla").closest("li");
    await user.click(within(row!).getByRole("button", { name: "Borrar" }));

    expect(
      await within(row!).findByText(
        "No se puede eliminar: ya tiene sesiones registradas.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Sentadilla")).toBeInTheDocument();
  });
});
