"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";

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
      <LogoutButton />
    </nav>
  );
}

function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    // Confirmación nativa: mismo criterio que DeleteSessionButton/
    // DeleteWeightButton (CLAUDE.md regla 4, un único usuario no necesita
    // un diálogo a medida).
    if (!window.confirm("¿Seguro que quieres cerrar sesión?")) {
      return;
    }

    setIsPending(true);
    // logout() redirige a /login en el propio Server Action (signOut con
    // redirectTo), así que no hace falta manejar un resultado de éxito ni
    // desactivar isPending tras el await: la navegación se encarga.
    await logout();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex h-11 items-center justify-center px-4 text-sm font-medium text-zinc-500 transition-colors disabled:opacity-60 dark:text-zinc-400"
    >
      {isPending ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}
