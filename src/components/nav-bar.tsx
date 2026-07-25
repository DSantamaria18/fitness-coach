"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { NAV_LINKS } from "@/lib/nav-links";

// BL-019: barra de pestañas inferior fija con las 4 secciones de uso
// frecuente, siempre visible (sin colapso ni menú hamburguesa — ver
// DECISIONS.md, entrada BL-009 sobre `hidden`/`sm:flex`, ya no aplica: no
// hay ningún estado que alternar). Franja superior separada, pequeña, con
// Ajustes y cerrar sesión, también siempre visible.
export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <div className="sticky top-0 z-10 flex h-11 items-center justify-end gap-1 border-b border-black/10 bg-white px-2 dark:border-white/10 dark:bg-black">
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          aria-current={pathname === "/ajustes" ? "page" : undefined}
          className="flex h-9 w-9 items-center justify-center rounded text-zinc-500 transition-colors dark:text-zinc-400"
        >
          <SettingsIcon />
        </Link>
        <LogoutButton />
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed right-0 bottom-0 left-0 z-10 flex border-t border-black/10 bg-white dark:border-white/10 dark:bg-black"
      >
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href;
          const Icon = NAV_ICONS[href];

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition-colors ${
                // `text-ember` resuelve a --color-ember (globals.css), que ya
                // se redefine bajo prefers-color-scheme: dark — no hace
                // falta una variante `dark:` aparte, a diferencia del resto
                // de esta barra (que sigue en zinc plano).
                isActive ? "text-ember" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
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
      className="flex h-9 items-center justify-center px-2 text-sm font-medium text-zinc-500 transition-colors disabled:opacity-60 dark:text-zinc-400"
    >
      {isPending ? "Cerrando sesión..." : "Cerrar sesión"}
    </button>
  );
}

/** Iconos inline, geometría simple (stroke, sin relleno) — puramente decorativos, el nombre accesible viene del Link/label que los contiene. */

function iconProps() {
  return {
    "aria-hidden": true as const,
    viewBox: "0 0 24 24",
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

/** Báscula: Peso. */
function ScaleIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Mancuerna: Sesión. */
function DumbbellIcon() {
  return (
    <svg {...iconProps()}>
      <line x1="2.5" y1="9.5" x2="2.5" y2="14.5" />
      <line x1="21.5" y1="9.5" x2="21.5" y2="14.5" />
      <line x1="5" y1="8" x2="5" y2="16" />
      <line x1="19" y1="8" x2="19" y2="16" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** Lista: Historial. */
function ListIcon() {
  return (
    <svg {...iconProps()}>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Barras: Informe. */
function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <line x1="7" y1="20" x2="7" y2="12" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="17" y1="20" x2="17" y2="4" />
    </svg>
  );
}

/** Engranaje: Ajustes. */
function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

const NAV_ICONS: Record<
  (typeof NAV_LINKS)[number]["href"],
  () => React.JSX.Element
> = {
  "/peso": ScaleIcon,
  "/sesion": DumbbellIcon,
  "/historial": ListIcon,
  "/informe": ChartIcon,
};
