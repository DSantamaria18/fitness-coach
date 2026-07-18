import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { WeightForm } from "./weight-form";

vi.mock("./actions", () => ({
  registerBodyWeight: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const mockedUseActionState = vi.mocked(useActionState);

describe("WeightForm", () => {
  it("renderiza los campos de peso y fecha", () => {
    render(<WeightForm />);

    expect(screen.getByLabelText(/peso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar/i }),
    ).toBeInTheDocument();
  });

  it("muestra un mensaje de error cuando la acción devuelve un estado de error", () => {
    mockedUseActionState.mockReturnValueOnce([
      { error: "El peso debe estar entre 20 y 300 kg." },
      vi.fn(),
      false,
    ]);

    render(<WeightForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El peso debe estar entre 20 y 300 kg.",
    );
  });

  it("muestra un mensaje de éxito cuando la acción devuelve un estado de éxito", () => {
    mockedUseActionState.mockReturnValueOnce([
      { success: true },
      vi.fn(),
      false,
    ]);

    render(<WeightForm />);

    expect(screen.getByText(/peso guardado/i)).toBeInTheDocument();
  });
});
