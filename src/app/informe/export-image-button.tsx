"use client";

import { useState } from "react";
import { domToPng } from "modern-screenshot";

// Mismo id que envuelve el contenido de /informe en page.tsx (estadísticas,
// filtros y gráficos incluida la comparación de periodos si está activa).
// Se busca por id en vez de recibir un ref por props porque este botón no
// necesita más acoplamiento con el árbol de componentes que "encontrar el
// contenedor en el DOM ya renderizado" (BL-007): toda la generación ocurre
// en el navegador, sin cruzar la frontera server/client de Next.
const INFORME_CONTENT_SELECTOR = "#informe-content";

function buildFileName(now: Date): string {
  // Fecha en formato ISO (YYYY-MM-DD) para que el nombre ordene bien
  // alfabéticamente si se descargan varios informes a lo largo del tiempo.
  const isoDate = now.toISOString().slice(0, 10);
  return `informe-progreso-${isoDate}.png`;
}

type Status = "idle" | "generating" | "error";

// Aviso discreto en fallo, sin romper la página: mismo criterio ya
// establecido para el resto de fallos "silenciosos" de /informe (ver
// DECISIONS.md BL-005/BL-006, ProgressComment).
export function ExportImageButton() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleClick() {
    const node = document.querySelector<HTMLElement>(INFORME_CONTENT_SELECTOR);
    if (!node) {
      setStatus("error");
      return;
    }

    setStatus("generating");
    try {
      const dataUrl = await domToPng(node, {
        // domToPng solo captura el subárbol de #informe-content, no
        // <body> — sin esto, el fondo del PNG queda transparente (blanco
        // en la mayoría de visores) mientras el texto sigue usando los
        // colores resueltos del tema activo (p. ej. las variantes
        // `dark:text-white/60`), dejando etiquetas casi ilegibles en modo
        // oscuro. Se toma el fondo real ya calculado por el navegador en
        // vez de asumir claro/oscuro, para que el PNG combine con lo que
        // el usuario está viendo en pantalla en ese momento.
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = buildFileName(new Date());
      link.click();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "generating"}
        className="self-start rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-white/20"
      >
        {status === "generating" ? "Generando..." : "Descargar imagen"}
      </button>
      {status === "error" ? (
        <p role="alert" className="text-sm text-black/60 dark:text-white/60">
          No se ha podido generar la imagen. Inténtalo de nuevo.
        </p>
      ) : null}
    </div>
  );
}
