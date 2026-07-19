import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useActionState } from "react";
import { ProgressComment } from "./progress-comment";

vi.mock("./actions", () => ({
  generateAndSaveProgressComment: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});

const mockedUseActionState = vi.mocked(useActionState);

describe("ProgressComment", () => {
  it("renderiza el botón para generar el comentario", () => {
    render(<ProgressComment initial={null} />);

    expect(
      screen.getByRole("button", { name: /generar comentario de progreso/i }),
    ).toBeInTheDocument();
  });

  it("no muestra ningún comentario todavía si nunca se ha generado uno", () => {
    render(<ProgressComment initial={null} />);

    expect(screen.queryByText(/generado el/i)).not.toBeInTheDocument();
  });

  it("muestra el comentario ya guardado al cargar la página, antes de pulsar el botón", () => {
    render(
      <ProgressComment
        initial={{
          texto: "Vas muy bien.",
          generadoEn: "2026-07-18T10:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Vas muy bien.")).toBeInTheDocument();
  });

  it("muestra el comentario recién generado cuando la acción devuelve éxito", () => {
    mockedUseActionState.mockReturnValueOnce([
      {
        success: true,
        texto: "Comentario nuevo generado por IA.",
        generadoEn: "2026-07-19T09:00:00.000Z",
      },
      vi.fn(),
      false,
    ]);

    render(<ProgressComment initial={null} />);

    expect(
      screen.getByText("Comentario nuevo generado por IA."),
    ).toBeInTheDocument();
  });

  it("muestra un aviso discreto en fallo, sin borrar el comentario anterior ya visible", () => {
    mockedUseActionState.mockReturnValueOnce([
      { error: "No se ha podido generar el comentario de progreso." },
      vi.fn(),
      false,
    ]);

    render(
      <ProgressComment
        initial={{
          texto: "Comentario anterior.",
          generadoEn: "2026-07-18T10:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se ha podido generar el comentario de progreso.",
    );
    // El fallo es un aviso discreto: el comentario anterior sigue visible,
    // nunca se sustituye por nada ni bloquea la pantalla.
    expect(screen.getByText("Comentario anterior.")).toBeInTheDocument();
  });

  it("deshabilita el botón y cambia su texto mientras la acción está en curso", () => {
    mockedUseActionState.mockReturnValueOnce([undefined, vi.fn(), true]);

    render(<ProgressComment initial={null} />);

    const button = screen.getByRole("button", { name: /generando/i });
    expect(button).toBeDisabled();
  });
});
