import type { ReactNode } from "react";

// Contenedor compartido (BL-019): unifica los `div` ad-hoc con borde/fondo
// propios que hasta ahora repetía cada página, sobre los tokens de color
// nuevos (bg-surface/border sutil) en vez de blanco/negro/zinc planos.
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-iron/15 bg-surface p-4 shadow-sm ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
