import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  logout: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { NavBar } from "./nav-bar";

const usePathnameMock = usePathname as unknown as ReturnType<typeof vi.fn>;
const logoutMock = vi.mocked(logout);

describe("NavBar", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("renderiza los 5 enlaces principales de la app", () => {
    usePathnameMock.mockReturnValue("/peso");
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Peso" })).toHaveAttribute(
      "href",
      "/peso",
    );
    expect(screen.getByRole("link", { name: "Sesión" })).toHaveAttribute(
      "href",
      "/sesion",
    );
    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute(
      "href",
      "/historial",
    );
    // /informe todavía no existe en esta rama (lo añade otro Developer en
    // paralelo, ver feature/informe-progreso), pero el enlace debe apuntar
    // ahí igualmente: existirá cuando ambas ramas se mergeen a master.
    expect(screen.getByRole("link", { name: "Informe" })).toHaveAttribute(
      "href",
      "/informe",
    );
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/ajustes",
    );
  });

  it("marca la ruta activa con aria-current=page y dejar el resto sin marcar", () => {
    usePathnameMock.mockReturnValue("/historial");
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "Historial" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Peso" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Sesión" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Informe" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Ajustes" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("no marca ningún enlace como activo si la ruta no coincide con ninguno", () => {
    usePathnameMock.mockReturnValue("/algo-desconocido");
    render(<NavBar />);

    for (const name of ["Peso", "Sesión", "Historial", "Informe", "Ajustes"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute(
        "aria-current",
      );
    }
  });

  it("pide confirmación antes de cerrar sesión y no llama a logout si se cancela", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    usePathnameMock.mockReturnValue("/peso");
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("llama a logout cuando se confirma el cierre de sesión", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    logoutMock.mockResolvedValue(undefined);
    usePathnameMock.mockReturnValue("/peso");
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));

    expect(logoutMock).toHaveBeenCalled();
  });
});
