import { redirect } from "next/navigation";
import { auth } from "@/auth";

// src/proxy.ts ya redirige a /login cualquier ruta protegida sin sesión
// (incluida esta), así que en producción esta función normalmente solo se
// ejecuta con sesión válida. El chequeo explícito del caso sin sesión se
// mantiene como defensa en profundidad (mismo patrón que /historial, ver
// DECISIONS.md) y para que "/" tenga un destino propio y testeable en vez
// de depender por completo de la lógica del middleware.
export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/historial");
    // redirect() interrumpe la ejecución lanzando internamente en Next real;
    // el `return` es solo para que, bajo test (donde se mockea sin lanzar),
    // no se llegue también al redirect("/login") de abajo.
    return;
  }

  redirect("/login");
}
