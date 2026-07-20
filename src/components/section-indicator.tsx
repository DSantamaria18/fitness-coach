"use client";

import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/nav-links";

// BL-010: indicador de la sección activa, visible junto al título de cada
// página (renderizado una sola vez en layout.tsx, no repetido en cada
// page.tsx — ver DECISIONS.md). No es un breadcrumb jerárquico: la app
// solo tiene un nivel de navegación (5 secciones planas), así que
// "Inicio > Sección > Subsección" no aportaría nada que la ruta activa ya
// resaltada en nav-bar.tsx no dé — esto es, en cambio, un refuerzo visual
// de esa misma información cerca del título, sin depender de mirar la
// barra fija arriba (que además puede estar colapsada detrás del menú
// hamburguesa en móvil, ver BL-009).
export function SectionIndicator() {
  const pathname = usePathname();
  const section = NAV_LINKS.find(({ href }) => href === pathname);

  if (!section) {
    return null;
  }

  return (
    <p className="px-4 pt-4 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      {section.label}
    </p>
  );
}
