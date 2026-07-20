import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { SectionIndicator } from "./section-indicator";

const usePathnameMock = usePathname as unknown as ReturnType<typeof vi.fn>;

// BL-010: indicador de la sección actual, visible junto al título de cada
// página, sin depender de mirar la barra de navegación fija arriba (que
// además puede estar colapsada detrás del menú hamburguesa en móvil, ver
// BL-009). Deriva el label de NAV_LINKS, la misma fuente que ya usa
// nav-bar.tsx para resaltar la ruta activa — no un breadcrumb jerárquico
// (Inicio > Sección > Subsección), que no aportaría nada en una app de un
// único nivel de navegación (ver DECISIONS.md).
describe("SectionIndicator", () => {
  it.each([
    ["/peso", "Peso"],
    ["/sesion", "Sesión"],
    ["/historial", "Historial"],
    ["/informe", "Informe"],
    ["/ajustes", "Ajustes"],
  ])("muestra «%s» -> «%s»", (pathname, label) => {
    usePathnameMock.mockReturnValue(pathname);
    render(<SectionIndicator />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("no muestra nada en una ruta que no es ninguna de las 5 secciones (p. ej. /login)", () => {
    usePathnameMock.mockReturnValue("/login");
    const { container } = render(<SectionIndicator />);

    expect(container).toBeEmptyDOMElement();
  });

  it("no muestra nada en la raíz (/), que redirige antes de mostrar contenido", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = render(<SectionIndicator />);

    expect(container).toBeEmptyDOMElement();
  });
});
