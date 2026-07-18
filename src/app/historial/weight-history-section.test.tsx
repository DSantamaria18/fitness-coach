import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { WeightHistorySection } from "./weight-history-section";
import { deleteWeightEntry } from "./actions";

vi.mock("./actions", () => ({
  updateWeightEntry: vi.fn(),
  deleteWeightEntry: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const mockedUseActionState = vi.mocked(useActionState);
const deleteWeightEntryMock = vi.mocked(deleteWeightEntry);

const entries = [
  { id: "bw-1", weightKg: 80.5, date: "2026-07-01T00:00:00.000Z" },
  { id: "bw-2", weightKg: 79.8, date: "2026-06-15T00:00:00.000Z" },
];

describe("WeightHistorySection", () => {
  beforeEach(() => {
    deleteWeightEntryMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("muestra un mensaje cuando no hay registros", () => {
    render(<WeightHistorySection entries={[]} />);

    expect(screen.getByText(/todavía no hay registros/i)).toBeInTheDocument();
  });

  it("lista cada registro con su peso y fecha, y las acciones de editar/borrar", () => {
    render(<WeightHistorySection entries={entries} />);

    expect(screen.getByText("80.5 kg")).toBeInTheDocument();
    expect(screen.getByText("01/07/2026")).toBeInTheDocument();
    expect(screen.getByText("79.8 kg")).toBeInTheDocument();
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /editar/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /borrar/i })).toHaveLength(2);
  });

  it("muestra el formulario de edición prefilled al pulsar Editar, y vuelve a la lista al pulsar Cancelar", async () => {
    const user = userEvent.setup();
    render(<WeightHistorySection entries={entries} />);

    await user.click(screen.getAllByRole("button", { name: /editar/i })[0]);

    const weightInput = screen.getByLabelText(/peso/i) as HTMLInputElement;
    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    expect(weightInput.value).toBe("80.5");
    expect(dateInput.value).toBe("2026-07-01");

    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByLabelText(/peso/i)).not.toBeInTheDocument();
    expect(screen.getByText("80.5 kg")).toBeInTheDocument();
  });

  it("muestra el error de la Server Action en el formulario de edición", async () => {
    mockedUseActionState.mockReturnValueOnce([
      { error: "El peso debe estar entre 20 y 300 kg." },
      vi.fn(),
      false,
    ]);
    const user = userEvent.setup();
    render(<WeightHistorySection entries={entries} />);

    await user.click(screen.getAllByRole("button", { name: /editar/i })[0]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El peso debe estar entre 20 y 300 kg.",
    );
  });

  it("pide confirmación antes de borrar y no llama a deleteWeightEntry si se cancela", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const user = userEvent.setup();
    render(<WeightHistorySection entries={entries} />);

    const row = screen.getByText("80.5 kg").closest("li");
    await user.click(within(row!).getByRole("button", { name: /borrar/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteWeightEntryMock).not.toHaveBeenCalled();
  });

  it("llama a deleteWeightEntry con el id del registro cuando se confirma el borrado", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteWeightEntryMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<WeightHistorySection entries={entries} />);

    const row = screen.getByText("80.5 kg").closest("li");
    await user.click(within(row!).getByRole("button", { name: /borrar/i }));

    expect(deleteWeightEntryMock).toHaveBeenCalledWith("bw-1");
  });

  it("muestra un mensaje de error si el borrado confirmado falla", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    deleteWeightEntryMock.mockResolvedValue({
      error: "Registro no encontrado.",
    });
    const user = userEvent.setup();
    render(<WeightHistorySection entries={entries} />);

    const row = screen.getByText("80.5 kg").closest("li");
    await user.click(within(row!).getByRole("button", { name: /borrar/i }));

    expect(
      await screen.findByText("Registro no encontrado."),
    ).toBeInTheDocument();
  });
});
