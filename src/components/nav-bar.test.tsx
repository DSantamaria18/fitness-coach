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

const getLink = (name: string) => screen.getByRole("link", { name });
const getLogoutButton = () =>
  screen.getByRole("button", { name: /cerrar sesión/i });

// BL-019: la barra ya no colapsa (adiós menú hamburguesa) — las 4 pestañas
// principales, Ajustes y el botón de logout están siempre presentes en el
// DOM, sin estado abierto/cerrado que comprobar.
describe("NavBar", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("renderiza siempre visibles los 4 enlaces principales de la app", () => {
    usePathnameMock.mockReturnValue("/peso");
    render(<NavBar />);

    expect(getLink("Peso")).toHaveAttribute("href", "/peso");
    expect(getLink("Sesión")).toHaveAttribute("href", "/sesion");
    expect(getLink("Historial")).toHaveAttribute("href", "/historial");
    expect(getLink("Informe")).toHaveAttribute("href", "/informe");
  });

  it("tiene siempre un enlace a Ajustes", () => {
    usePathnameMock.mockReturnValue("/peso");
    render(<NavBar />);

    expect(getLink("Ajustes")).toHaveAttribute("href", "/ajustes");
  });

  it("marca la ruta activa con aria-current=page y deja el resto sin marcar", () => {
    usePathnameMock.mockReturnValue("/historial");
    render(<NavBar />);

    expect(getLink("Historial")).toHaveAttribute("aria-current", "page");
    expect(getLink("Peso")).not.toHaveAttribute("aria-current");
    expect(getLink("Sesión")).not.toHaveAttribute("aria-current");
    expect(getLink("Informe")).not.toHaveAttribute("aria-current");
    expect(getLink("Ajustes")).not.toHaveAttribute("aria-current");
  });

  it("no marca ningún enlace como activo si la ruta no coincide con ninguno", () => {
    usePathnameMock.mockReturnValue("/algo-desconocido");
    render(<NavBar />);

    for (const name of ["Peso", "Sesión", "Historial", "Informe", "Ajustes"]) {
      expect(getLink(name)).not.toHaveAttribute("aria-current");
    }
  });

  it("pide confirmación antes de cerrar sesión y no llama a logout si se cancela", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    usePathnameMock.mockReturnValue("/peso");
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(getLogoutButton());

    expect(window.confirm).toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("llama a logout cuando se confirma el cierre de sesión", async () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    logoutMock.mockResolvedValue(undefined);
    usePathnameMock.mockReturnValue("/peso");
    const user = userEvent.setup();
    render(<NavBar />);

    await user.click(getLogoutButton());

    expect(logoutMock).toHaveBeenCalled();
  });
});
