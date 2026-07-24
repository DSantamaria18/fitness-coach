import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SessionEntriesEditor } from "./session-entries-editor";
import type { RegistroState } from "@/lib/session-proposal/build-initial-registros";

// Reporte de un corredor real: "Duración (s)"/"Ritmo medio (s/km)" en
// segundos totales confunden, y toNumber() descartaba en silencio un valor
// con coma decimal ("0,1" -> NaN sin normalizar). Estos tests verifican el
// comportamiento observable del editor (el JSON que acaba enviándose en el
// input oculto "ejercicios"), no los detalles internos — ver DECISIONS.md.

const exercises = [
  { id: "ex-1", name: "Sentadilla", type: "STRENGTH" as const },
  { id: "ex-2", name: "Carrera", type: "CARDIO" as const },
];

// Host de prueba: SessionEntriesEditor recibe `registros` como prop
// controlado por el padre (ver DECISIONS.md 2026-07-18), así que necesita un
// componente que le dé estado real para poder interactuar con él.
function Harness() {
  const [registros, setRegistros] = useState<RegistroState[]>([]);
  return (
    <form>
      <SessionEntriesEditor
        exercises={exercises}
        registros={registros}
        onRegistrosChange={setRegistros}
      />
    </form>
  );
}

function getPayload(container: HTMLElement) {
  const hidden = container.querySelector<HTMLInputElement>(
    'input[name="ejercicios"]',
  );
  return JSON.parse(hidden?.value ?? "[]");
}

async function addExercise(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.selectOptions(screen.getByLabelText(/añadir ejercicio/i), name);
  await user.click(screen.getByRole("button", { name: /^añadir$/i }));
}

describe("SessionEntriesEditor", () => {
  it("etiqueta duración y ritmo medio en mm:ss y ofrece placeholders de ejemplo", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Carrera");

    expect(screen.getByLabelText(/duración \(mm:ss\)/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/ritmo medio \(min:seg\/km\)/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ej: 8:30")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ej: 5:30")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ej: 5,2")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("ej: 10,5")).toBeInTheDocument();
  });

  it("ofrece un placeholder de ejemplo con coma decimal para el peso", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Sentadilla");

    expect(screen.getByPlaceholderText("ej: 82,5")).toBeInTheDocument();
  });

  it("normaliza coma decimal a punto en el peso de una serie de fuerza", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await addExercise(user, "Sentadilla");
    await user.type(screen.getByLabelText(/^peso/i), "82,5");

    const [entrada] = getPayload(container);
    expect(entrada.series[0].peso_kg).toBe(82.5);
  });

  it("normaliza coma decimal a punto en distancia y vel. media de cardio", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await addExercise(user, "Carrera");
    await user.type(screen.getByLabelText(/distancia/i), "5,2");
    await user.type(screen.getByLabelText(/vel\. media/i), "10,5");

    const [entrada] = getPayload(container);
    expect(entrada.distancia_km).toBe(5.2);
    expect(entrada.velocidad_media).toBe(10.5);
  });

  it("sigue aceptando el punto decimal igual que antes (no rompe el formato previo)", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await addExercise(user, "Sentadilla");
    await user.type(screen.getByLabelText(/^peso/i), "82.5");

    const [entrada] = getPayload(container);
    expect(entrada.series[0].peso_kg).toBe(82.5);
  });

  it("convierte duración y ritmo medio en formato mm:ss a segundos totales en el payload", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await addExercise(user, "Carrera");
    await user.type(screen.getByLabelText(/duración/i), "8:30");
    await user.type(screen.getByLabelText(/ritmo medio/i), "5:15");

    const [entrada] = getPayload(container);
    expect(entrada.duracion).toBe(510);
    expect(entrada.ritmo_medio).toBe(315);
  });

  it("no muestra ningún aviso mientras el campo de duración está vacío (es opcional)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Carrera");

    expect(screen.queryByText(/formato inválido/i)).not.toBeInTheDocument();
  });

  it("muestra un aviso claro cuando la duración no tiene formato mm:ss válido, en vez de descartarla en silencio", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await addExercise(user, "Carrera");
    await user.type(screen.getByLabelText(/duración/i), "abc");

    expect(screen.getByRole("alert")).toHaveTextContent(/formato inválido/i);
    // El dato inválido no se guarda como si fuera válido (sigue siendo
    // undefined, igual que un campo vacío), pero a diferencia de un campo
    // vacío el usuario ya ha visto el aviso de arriba.
    const [entrada] = getPayload(container);
    expect(entrada.duracion).toBeUndefined();
  });

  it("muestra un aviso cuando el ritmo medio tiene segundos fuera de rango (>= 60)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Carrera");
    await user.type(screen.getByLabelText(/ritmo medio/i), "5:75");

    expect(screen.getByRole("alert")).toHaveTextContent(/formato inválido/i);
  });

  it("aclara en el tooltip del peso de fuerza que es peso añadido y que se deja vacío a peso corporal", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Sentadilla");

    const pesoInput = screen.getByLabelText(/^peso/i);
    // El bug de la ronda anterior fue sugerir "0" como sentinel de "a peso
    // corporal" cuando el esquema lo rechaza (peso_kg exige > 0) — el
    // tooltip no debe repetir ese error y sí debe decir "vacío".
    expect(pesoInput.getAttribute("title")).toMatch(/vacío/i);
    expect(pesoInput.getAttribute("title")).not.toMatch(/\b0\b/);
  });

  it("aclara en el tooltip de los campos decimales de cardio que admiten coma o punto", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await addExercise(user, "Carrera");

    for (const label of [/distancia/i, /vel\. media/i, /cadencia/i]) {
      const input = screen.getByLabelText(label);
      expect(input.getAttribute("title")).toMatch(/coma.*punto|punto.*coma/i);
    }
  });
});
