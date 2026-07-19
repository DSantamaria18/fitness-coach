import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { NavBar } from "./nav-bar";

const usePathnameMock = usePathname as unknown as ReturnType<typeof vi.fn>;

describe("NavBar", () => {
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
});
