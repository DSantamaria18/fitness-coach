// BL-019: las 4 secciones de uso frecuente, mostradas siempre en la barra de
// pestañas inferior de nav-bar.tsx. Ajustes ya no vive aquí — tiene su
// propio enlace fijo (icono de engranaje) en la franja superior de
// nav-bar.tsx, fuera de las pestañas principales.
export const NAV_LINKS = [
  { href: "/peso", label: "Peso" },
  { href: "/sesion", label: "Sesión" },
  { href: "/historial", label: "Historial" },
  { href: "/informe", label: "Informe" },
] as const;
