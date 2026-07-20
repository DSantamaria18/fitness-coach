import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { domToPng } from "modern-screenshot";
import { ExportImageButton } from "./export-image-button";

vi.mock("modern-screenshot", () => ({
  domToPng: vi.fn(),
}));

const mockedDomToPng = vi.mocked(domToPng);

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
    // verificación manual, ver DECISIONS.md).
    expect(mockedDomToPng).toHaveBeenCalledWith(
      document.querySelector("#informe-content"),
      { backgroundColor: getComputedStyle(document.body).backgroundColor },
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
