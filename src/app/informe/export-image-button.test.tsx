import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { domToPng, type Options } from "modern-screenshot";
import { ExportImageButton } from "./export-image-button";

vi.mock("modern-screenshot", () => ({
  domToPng: vi.fn(),
}));

const mockedDomToPng = vi.mocked(domToPng);

// domToPng está sobrecargada (`(node, options?)` | `(context)`), así que
// `mockedDomToPng.mock.calls[n]` infiere una unión de tuplas de longitudes
// distintas — indexar `[1]` directamente no tipa bien. Los tests siempre
// invocan la forma `(node, options)`, así que se castea explícitamente a
// esa forma en vez de a la unión completa.
function getCallOptions(callIndex: number): Options | undefined {
  const call = mockedDomToPng.mock.calls[callIndex] as unknown as
    [Node, Options?] | undefined;
  return call?.[1];
}

// El componente busca el contenedor real por id (mismo selector que usará
// page.tsx en producción, `#informe-content`) en vez de recibirlo por props:
// así el test cubre el mismo camino real (document.querySelector) sin
// necesidad de pasar un ref a través de la frontera server/client.
function renderWithInformeContent() {
  return render(
    <div id="informe-content">
      <ExportImageButton />
    </div>,
  );
}

describe("ExportImageButton", () => {
  beforeEach(() => {
    mockedDomToPng.mockReset();
    // click() no está implementado en jsdom (no hay descarga real de
    // ficheros en un entorno sin navegador); se sustituye por un spy para
    // poder comprobar que se disparó sin que jsdom lance "Not implemented".
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("renderiza el botón de descarga", () => {
    renderWithInformeContent();

    expect(
      screen.getByRole("button", { name: /descargar imagen/i }),
    ).toBeInTheDocument();
  });

  it("genera el PNG del contenedor #informe-content y dispara su descarga al hacer clic", async () => {
    const dataUrl = "data:image/png;base64,ABC123";
    mockedDomToPng.mockResolvedValueOnce(dataUrl);
    // Se captura el `<a>` creado espiando document.createElement en vez de
    // usar `this` dentro del mock de `.click()` (evita el aviso de lint
    // @typescript-eslint/no-this-alias, y es igual de fiel al
    // comportamiento observable: "se crea y clickea un <a> de descarga").
    let clickedAnchor: HTMLAnchorElement | undefined;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") {
        clickedAnchor = element as HTMLAnchorElement;
      }
      return element;
    });

    renderWithInformeContent();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    await waitFor(() => expect(clickedAnchor).toBeDefined());

    // domToPng se llama con el contenedor real de la vista (no con
    // cualquier nodo: es el mismo elemento que envuelve toda la página
    // /informe) y con el fondo real ya calculado por el navegador — sin
    // esto el PNG queda con fondo transparente/blanco mientras el texto
    // sigue usando los colores del tema activo (p. ej. `dark:text-white/60`),
    // dejando etiquetas casi ilegibles en modo oscuro (bug encontrado en
    // verificación manual, ver DECISIONS.md). `objectContaining` en vez de
    // un objeto exacto porque también se pasa `onCloneEachNode` (cubierto
    // por su propio test más abajo).
    expect(mockedDomToPng).toHaveBeenCalledWith(
      document.querySelector("#informe-content"),
      expect.objectContaining({
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      }),
    );
    expect(clickedAnchor?.href).toBe(dataUrl);
    // Nombre de fichero sugerido por el encargo: informe-progreso-<fecha>.png.
    expect(clickedAnchor?.download).toMatch(
      /^informe-progreso-\d{4}-\d{2}-\d{2}\.png$/,
    );
    // Confirma que la descarga se dispara de verdad (no solo que el <a> se
    // construye con los atributos correctos).
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("corrige en el clon la opción marcada de cada <select> para que coincida con el valor real elegido por el usuario", async () => {
    // Bug real encontrado por QA (ver DECISIONS.md): modern-screenshot solo
    // conserva en el clon el atributo HTML `selected` que ya estaba en el
    // marcado original de cada <option> — no la propiedad viva `.value`
    // del <select>, que es como ExerciseSelector/ComparisonPeriodSelector
    // (controlados por la URL) reflejan realmente el filtro activo. La
    // librería sí copia el valor vivo a un atributo `value` en el <select>
    // clonado (su propio mecanismo interno para <input>/<textarea>), pero
    // ese atributo no existe en HTML para <select> y no afecta qué
    // <option> se ve seleccionada al rasterizar — hay que traducirlo
    // manualmente a la <option> correcta vía `onCloneEachNode`.
    mockedDomToPng.mockResolvedValueOnce("data:image/png;base64,ABC123");

    renderWithInformeContent();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    await waitFor(() => expect(mockedDomToPng).toHaveBeenCalled());

    const onCloneEachNode = getCallOptions(0)?.onCloneEachNode;
    expect(onCloneEachNode).toBeInstanceOf(Function);

    // Simula lo que modern-screenshot entrega de verdad al callback: un
    // <select> clonado donde la <option> "por defecto" del marcado sigue
    // teniendo `selected` (aunque el usuario haya elegido otra), pero el
    // propio elemento clonado ya lleva el atributo `value` correcto.
    const clonedSelect = document.createElement("select");
    clonedSelect.setAttribute("value", "mes");
    const optionSinComparar = document.createElement("option");
    optionSinComparar.value = "";
    optionSinComparar.setAttribute("selected", "");
    const optionMes = document.createElement("option");
    optionMes.value = "mes";
    clonedSelect.append(optionSinComparar, optionMes);

    await onCloneEachNode?.(clonedSelect);

    expect(optionSinComparar.hasAttribute("selected")).toBe(false);
    expect(optionMes.hasAttribute("selected")).toBe(true);
  });

  it("no toca nodos que no son <select> al pasar por onCloneEachNode", async () => {
    mockedDomToPng.mockResolvedValueOnce("data:image/png;base64,ABC123");

    renderWithInformeContent();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    await waitFor(() => expect(mockedDomToPng).toHaveBeenCalled());

    const onCloneEachNode = getCallOptions(0)?.onCloneEachNode;
    const div = document.createElement("div");

    // No debe lanzar ni intentar tratar el nodo como si tuviera <option>.
    expect(() => onCloneEachNode?.(div)).not.toThrow();
  });

  it("muestra 'Generando...' y deshabilita el botón mientras se genera la imagen", async () => {
    let resolvePromise!: (value: string) => void;
    mockedDomToPng.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      }),
    );

    renderWithInformeContent();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    expect(screen.getByRole("button", { name: /generando/i })).toBeDisabled();

    resolvePromise("data:image/png;base64,ABC123");

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /descargar imagen/i }),
      ).not.toBeDisabled(),
    );
  });

  it("muestra un aviso discreto si falla la generación de la imagen, sin romper la página", async () => {
    mockedDomToPng.mockRejectedValueOnce(new Error("boom"));

    renderWithInformeContent();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no se ha podido generar la imagen/i,
    );
    // El fallo es un aviso discreto (mismo criterio que ProgressComment,
    // DECISIONS.md BL-005/BL-006): el botón vuelve a estar disponible, la
    // página no se rompe.
    expect(
      screen.getByRole("button", { name: /descargar imagen/i }),
    ).not.toBeDisabled();
  });

  it("muestra un aviso discreto si el contenedor #informe-content no existe en el DOM", async () => {
    // Defensa ante un desajuste entre este componente y page.tsx (el id
    // cambia de nombre, o el componente se usa fuera de /informe por
    // error): no debe intentar llamar a domToPng con `null`.
    render(<ExportImageButton />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /descargar imagen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no se ha podido generar la imagen/i,
    );
    expect(mockedDomToPng).not.toHaveBeenCalled();
  });
});
