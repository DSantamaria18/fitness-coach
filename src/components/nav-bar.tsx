"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// /informe todavía no existe en esta rama: lo añade otro Developer en
// paralelo (feature/informe-progreso). El enlace apunta ahí igualmente,
// existirá en cuanto ambas ramas se mergeen a master.
const NAV_LINKS = [
  { href: "/peso", label: "Peso" },
  { href: "/sesion", label: "Sesión" },
  { href: "/historial", label: "Historial" },
  { href: "/informe", label: "Informe" },
  { href: "/ajustes", label: "Ajustes" },
] as const;

// Barra de navegación mobile-first: fila de enlaces con altura mínima de
// 44px (tamaño de toque recomendado en iOS/Android), ya que el uso
// principal de la app es desde el navegador del móvil (ver SPEC.md §2/§6).
export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="sticky top-0 z-10 flex border-b border-black/10 bg-white dark:border-white/10 dark:bg-black"
    >
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-11 flex-1 items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
