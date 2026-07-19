import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { DateRangeFilter } from "./date-range-filter";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);
const pushMock = vi.fn();

describe("DateRangeFilter", () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockedUseRouter.mockReturnValue({
      push: pushMock,
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it("refleja los valores 'desde'/'hasta' recibidos por prop", () => {
    render(<DateRangeFilter desde="2026-06-01" hasta="2026-06-30" />);

    expect(screen.getByLabelText(/desde/i)).toHaveValue("2026-06-01");
    expect(screen.getByLabelText(/hasta/i)).toHaveValue("2026-06-30");
  });

  it("muestra los inputs vacíos cuando no hay filtro de fechas activo", () => {
    render(<DateRangeFilter desde="" hasta="" />);

    expect(screen.getByLabelText(/desde/i)).toHaveValue("");
    expect(screen.getByLabelText(/hasta/i)).toHaveValue("");
  });

  it("navega con el nuevo 'desde' al cambiarlo, preservando otros parámetros de la URL", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams("ejercicio=Sentadilla") as unknown as ReturnType<
        typeof useSearchParams
      >,
    );
    const user = userEvent.setup();
    render(<DateRangeFilter desde="" hasta="" />);

    await user.type(screen.getByLabelText(/desde/i), "2026-06-01");

    expect(pushMock).toHaveBeenCalled();
    const lastUrl = pushMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split("?")[1]);
    expect(params.get("ejercicio")).toBe("Sentadilla");
    expect(params.get("desde")).toBe("2026-06-01");
  });

  it("navega con el nuevo 'hasta' al cambiarlo, preservando otros parámetros de la URL", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "ejercicio=Sentadilla&desde=2026-06-01",
      ) as unknown as ReturnType<typeof useSearchParams>,
    );
    const user = userEvent.setup();
    render(<DateRangeFilter desde="2026-06-01" hasta="" />);

    await user.type(screen.getByLabelText(/hasta/i), "2026-06-30");

    expect(pushMock).toHaveBeenCalled();
    const lastUrl = pushMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split("?")[1]);
    expect(params.get("ejercicio")).toBe("Sentadilla");
    expect(params.get("desde")).toBe("2026-06-01");
    expect(params.get("hasta")).toBe("2026-06-30");
  });

  it("quita el parámetro 'desde' de la URL al vaciar el campo", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams("desde=2026-06-01") as unknown as ReturnType<
        typeof useSearchParams
      >,
    );
    const user = userEvent.setup();
    render(<DateRangeFilter desde="2026-06-01" hasta="" />);

    await user.clear(screen.getByLabelText(/desde/i));

    expect(pushMock).toHaveBeenCalledWith("/informe");
  });

  it("al cambiar una fecha, borra la comparación de periodos ya activa en la URL (mutuamente excluyentes, BL-005/BL-006)", async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams("comparar=mes") as unknown as ReturnType<
        typeof useSearchParams
      >,
    );
    const user = userEvent.setup();
    render(<DateRangeFilter desde="" hasta="" />);

    await user.type(screen.getByLabelText(/desde/i), "2026-06-01");

    const lastUrl = pushMock.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(lastUrl.split("?")[1]);
    expect(params.has("comparar")).toBe(false);
    expect(params.get("desde")).toBe("2026-06-01");
  });
});
