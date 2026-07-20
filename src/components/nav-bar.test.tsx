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
const getMenuToggle = () =>
  screen.getByRole("button", { name: /(abrir|cerrar) menú/i });

// BL-009: el estado abierto/cerrado del menú móvil se expresa con las
// clases Tailwind `hidden`/`flex` (más `sm:flex` fijo para que en
// pantallas grandes se muestre siempre) — jsdom no aplica hojas de estilo
// reales, así que `toBeVisible()` no distingue nada aquí; hay que
// comprobar directamente qué clase lleva el contenedor. Verificado
// también que esto es necesario en navegador real: Tailwind v4 fuerza
// `[hidden] { display: none !important }` en su Preflight, así que NO se
// puede usar el atributo nativo `hidden` combinado con `sm:flex` (se
// probó y dejaba la barra vacía en desktop) — ver DECISIONS.md.
const getNavLinksContainer = () => document.getElementById("nav-links")!;

describe("NavBar", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    vi.spyOn(window, "confirm");
  });

  it("renderiza los 5 enlaces principales de la app", () => {
    usePathnameMock.mockReturnValue("/peso");
    render(<NavBar />);

    expect(getLink("Peso")).toHaveAttribute("href", "/peso");
    expect(getLink("Sesión")).toHaveAttribute("href", "/sesion");
    expect(getLink("Historial")).toHaveAttribute("href", "/historial");
    // /informe todavía no existe en esta rama (lo añade otro Developer en
    // paralelo, ver feature/informe-progreso), pero el enlace debe apuntar
    // ahí igualmente: existirá cuando ambas ramas se mergeen a master.
    expect(getLink("Informe")).toHaveAttribute("href", "/informe");
    expect(getLink("Ajustes")).toHaveAttribute("href", "/ajustes");
  });

  it("marca la ruta activa con aria-current=page y dejar el resto sin marcar", () => {
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

  describe("menú hamburguesa (BL-009)", () => {
    it("existe y empieza cerrado", () => {
      usePathnameMock.mockReturnValue("/peso");
      render(<NavBar />);

      const toggle = screen.getByRole("button", { name: /abrir menú/i });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(getNavLinksContainer()).toHaveClass("hidden");
      expect(getNavLinksContainer()).not.toHaveClass("flex");
    });

    it("al hacer clic, se abre: aria-expanded pasa a true y los enlaces (y el logout) se vuelven visibles/navegables", async () => {
      usePathnameMock.mockReturnValue("/peso");
      const user = userEvent.setup();
      render(<NavBar />);

      await user.click(getMenuToggle());

      expect(
        screen.getByRole("button", { name: /cerrar menú/i }),
      ).toHaveAttribute("aria-expanded", "true");
      expect(getNavLinksContainer()).toHaveClass("flex");
      expect(getNavLinksContainer()).not.toHaveClass("hidden");
      // Navegable: sigue siendo un <a href> normal, foco estándar del navegador.
      getLink("Peso").focus();
      expect(getLink("Peso")).toHaveFocus();
      expect(getLogoutButton()).toBeEnabled();
    });

    it("se cierra al pulsar Escape con el menú abierto", async () => {
      usePathnameMock.mockReturnValue("/peso");
      const user = userEvent.setup();
      render(<NavBar />);

      await user.click(getMenuToggle());
      expect(getNavLinksContainer()).toHaveClass("flex");

      await user.keyboard("{Escape}");

      expect(getMenuToggle()).toHaveAttribute("aria-expanded", "false");
      expect(getNavLinksContainer()).toHaveClass("hidden");
    });

    it("se cierra al hacer clic fuera del menú", async () => {
      usePathnameMock.mockReturnValue("/peso");
      const user = userEvent.setup();
      render(
        <div>
          <button type="button">Fuera del menú</button>
          <NavBar />
        </div>,
      );

      await user.click(getMenuToggle());
      expect(getNavLinksContainer()).toHaveClass("flex");

      await user.click(screen.getByRole("button", { name: "Fuera del menú" }));

      expect(getMenuToggle()).toHaveAttribute("aria-expanded", "false");
      expect(getNavLinksContainer()).toHaveClass("hidden");
    });

    it("se cierra al hacer clic en un enlace del menú abierto", async () => {
      usePathnameMock.mockReturnValue("/peso");
      const user = userEvent.setup();
      render(<NavBar />);

      await user.click(getMenuToggle());
      await user.click(getLink("Historial"));

      expect(getMenuToggle()).toHaveAttribute("aria-expanded", "false");
      expect(getNavLinksContainer()).toHaveClass("hidden");
    });
  });
});
