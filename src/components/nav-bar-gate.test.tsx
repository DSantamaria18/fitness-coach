import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/historial",
}));

import { auth } from "@/auth";
import { NavBarGate } from "./nav-bar-gate";

// `auth` es una función sobrecargada (uso directo y como middleware);
// vi.mocked infiere una intersección inservible para mockResolvedValue,
// mismo patrón que src/app/api/body-weight/route.test.ts.
const authMock = auth as unknown as ReturnType<typeof vi.fn>;

describe("NavBarGate", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("muestra la barra de navegación con sus 5 enlaces cuando hay sesión", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });

    render(await NavBarGate());

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Peso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sesión" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Historial" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Informe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toBeInTheDocument();
  });

  it("no renderiza nada cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    const result = await NavBarGate();

    expect(result).toBeNull();
  });
});
