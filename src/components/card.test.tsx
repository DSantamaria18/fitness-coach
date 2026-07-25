import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./card";

// BL-019 (tokens visuales + tarjetas): Card es un contenedor puramente
// visual, así que el contrato a testear es "renderiza sus children" y
// "admite className adicional (passthrough)" — nunca el marcado interno
// exacto, para no romper si el diseño interno cambia sin cambiar el
// comportamiento (CLAUDE.md regla 5).
describe("Card", () => {
  it("renderiza sus children", () => {
    render(
      <Card>
        <p>Contenido de la tarjeta</p>
      </Card>,
    );

    expect(screen.getByText("Contenido de la tarjeta")).toBeInTheDocument();
  });

  it("admite una className adicional sin perder las propias", () => {
    const { container } = render(<Card className="custom-class">hola</Card>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("custom-class");
  });
});
