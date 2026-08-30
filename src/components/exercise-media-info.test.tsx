import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseMediaInfo } from "./exercise-media-info";

describe("ExerciseMediaInfo", () => {
  it("no renderiza nada si el ejercicio no tiene enriquecimiento", () => {
    const { container } = render(
      <ExerciseMediaInfo
        name="Sentadilla"
        instructionsEs={null}
        imageUrl={null}
        gifUrl={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra la imagen estática, las instrucciones y la atribución obligatoria", () => {
    render(
      <ExerciseMediaInfo
        name="Flexiones"
        instructionsEs="Comienza en una posición de plancha alta..."
        imageUrl="/exercise-media/0662.jpg"
        gifUrl="/exercise-media/0662.gif"
      />,
    );

    const image = screen.getByRole("img", { name: /flexiones/i });
    expect(image).toHaveAttribute("src", "/exercise-media/0662.jpg");
    expect(
      screen.getByText(/comienza en una posición de plancha alta/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/gym visual/i)).toBeInTheDocument();
  });

  it("cambia a la animación GIF al pulsar 'Ver animación'", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseMediaInfo
        name="Flexiones"
        instructionsEs="Instrucciones."
        imageUrl="/exercise-media/0662.jpg"
        gifUrl="/exercise-media/0662.gif"
      />,
    );

    await user.click(screen.getByRole("button", { name: /ver animación/i }));

    expect(screen.getByRole("img", { name: /flexiones/i })).toHaveAttribute(
      "src",
      "/exercise-media/0662.gif",
    );
  });
});
