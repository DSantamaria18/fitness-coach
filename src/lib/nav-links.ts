// Fuente única de las 5 secciones de la app — compartida entre nav-bar.tsx
// (enlaces de la barra de navegación) y section-indicator.tsx (BL-010,
// indicador de sección visible junto al título de cada página), para no
// mantener el mismo mapeo href/label duplicado en dos sitios.
export const NAV_LINKS = [
  { href: "/peso", label: "Peso" },
  { href: "/sesion", label: "Sesión" },
  { href: "/historial", label: "Historial" },
  { href: "/informe", label: "Informe" },
  { href: "/ajustes", label: "Ajustes" },
] as const;
