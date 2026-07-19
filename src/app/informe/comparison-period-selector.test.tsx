import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { ComparisonPeriodSelector } from "./comparison-period-selector";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const pushMock = vi.fn();

describe("ComparisonPeriodSelector", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockedUseRouter.mockReturnValue({
      push: pushMock,
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it("renderiza las tres opciones", () => {
    render(<ComparisonPeriodSelector selected="" />);

    expect(
      screen.getByRole("option", { name: /sin comparar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /este mes vs\. anterior/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /este año vs\. anterior/i }),
    ).toBeInTheDocument();
  });

  it("refleja el preset seleccionado recibido por prop", () => {
    render(<ComparisonPeriodSelector selected="mes" />);

    expect(screen.getByRole("combobox")).toHaveValue("mes");
  });

  it("navega con ?comparar=mes al elegir 'Este mes vs. anterior'", async () => {
    const user = userEvent.setup();
    render(<ComparisonPeriodSelector selected="" />);

    await user.selectOptions(screen.getByRole("combobox"), "mes");

    expect(pushMock).toHaveBeenCalledWith("/informe?comparar=mes");
  });

  it("navega a /informe sin query param al elegir 'Sin comparar'", async () => {
    const user = userEvent.setup();
    render(<ComparisonPeriodSelector selected="anio" />);

    await user.selectOptions(screen.getByRole("combobox"), "");

    expect(pushMock).toHaveBeenCalledWith("/informe");
  });

  it("al activar la comparación, borra el rango de fechas manual ya presente en la URL (mutuamente excluyentes, BL-005/BL-006)", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "desde=2026-06-01&hasta=2026-06-30",
      ) as unknown as ReturnType<typeof useSearchParams>,
    );
    const user = userEvent.setup();
    render(<ComparisonPeriodSelector selected="" />);

    await user.selectOptions(screen.getByRole("combobox"), "anio");

    expect(pushMock).toHaveBeenCalledWith("/informe?comparar=anio");
  });

  it("preserva otros parámetros de la URL (p.ej. el ejercicio filtrado)", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams("ejercicio=Sentadilla") as unknown as ReturnType<
        typeof useSearchParams
      >,
    );
    const user = userEvent.setup();
    render(<ComparisonPeriodSelector selected="" />);

    await user.selectOptions(screen.getByRole("combobox"), "mes");

    const lastUrl = pushMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split("?")[1]);
    expect(params.get("ejercicio")).toBe("Sentadilla");
    expect(params.get("comparar")).toBe("mes");
  });
});
