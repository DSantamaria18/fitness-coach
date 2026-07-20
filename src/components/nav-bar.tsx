"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { NAV_LINKS } from "@/lib/nav-links";

// Barra de navegación mobile-first: fila de enlaces con altura mínima de
// 44px (tamaño de toque recomendado en iOS/Android), ya que el uso
// principal de la app es desde el navegador del móvil (ver SPEC.md §2/§6).
//
// BL-009: por debajo del breakpoint `sm` (640px, ya en uso en el resto del
// proyecto — ver informe/date-range-filter.tsx), los enlaces y el botón de
// logout colapsan detrás de un botón hamburguesa en vez de repartirse en
// fila; en `sm:` y superior se comportan exactamente igual que antes. El
// contenedor de enlaces alterna las clases `hidden`/`flex` según
// `isMenuOpen`, con `sm:flex` fijo para que en pantallas grandes se
// muestre siempre pese a la clase `hidden` (idioma estándar de Tailwind,
// mismo criterio de breakpoint que el resto del proyecto). Se probó primero
// con el atributo NATIVO `hidden` del elemento (mejor semántica de
// accesibilidad en teoría), pero Tailwind v4 fuerza
// `[hidden] { display: none !important }` en su Preflight — verificado en
// navegador real, dejaba la barra vacía también en pantallas grandes — así
// que no es viable combinarlo con una utilidad de display responsive en
// este proyecto (ver DECISIONS.md).
export function NavBar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Cierra el menú en cuanto cambia la ruta, para que no quede abierto tras
  // navegar (además del cierre explícito en el onClick de cada enlace, que
  // cubre el instante del clic antes de que la navegación complete). Ajuste
  // de estado durante el render (no en un efecto): es el patrón que React
  // recomienda para "resetear estado cuando cambia una prop/valor externo"
  // (https://react.dev/learn/you-might-not-need-an-effect), y evita el
  // aviso de lint react-hooks/set-state-in-effect por llamar a setState
  // síncronamente dentro de un efecto sin suscribirse a nada externo.
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    setIsMenuOpen(false);
  }

  // Los listeners de Escape/clic-fuera solo se registran mientras el menú
  // está abierto, para no añadir trabajo innecesario en el caso común
  // (menú cerrado, o pantallas grandes donde nunca se abre).
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <nav
      ref={navRef}
      aria-label="Navegación principal"
      className="sticky top-0 z-10 border-b border-black/10 bg-white dark:border-white/10 dark:bg-black"
    >
      <div className="flex items-center justify-end sm:hidden">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="nav-links"
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          className="flex h-11 w-11 items-center justify-center text-zinc-500 dark:text-zinc-400"
        >
          <MenuIcon open={isMenuOpen} />
        </button>
      </div>
      <div
        id="nav-links"
        className={`${isMenuOpen ? "flex flex-col" : "hidden"} sm:flex sm:flex-1 sm:flex-row`}
      >
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              onClick={closeMenu}
              className={`flex h-11 items-center justify-center text-sm font-medium transition-colors sm:flex-1 ${
                isActive
                  ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <LogoutButton onLogoutStart={closeMenu} />
      </div>
    </nav>
  );
}

/** Icono hamburguesa/cerrar (X) según `open` — puramente decorativo, el nombre accesible viene del `aria-label` del botón que lo contiene. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      {open ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 6l12 12M18 6L6 18"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 12h16M4 18h16"
        />
      )}
    </svg>
  );
}

function LogoutButton({ onLogoutStart }: { onLogoutStart: () => void }) {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    // Confirmación nativa: mismo criterio que DeleteSessionButton/
    // DeleteWeightButton (CLAUDE.md regla 4, un único usuario no necesita
    // un diálogo a medida).
    if (!window.confirm("¿Seguro que quieres cerrar sesión?")) {
      return;
    }

    onLogoutStart();
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
