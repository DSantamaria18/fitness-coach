"use server";

import { signOut } from "@/auth";

// Vive fuera de cualquier ruta concreta (a diferencia de sesion/actions.ts o
// peso/actions.ts) porque el logout no pertenece a una sola sección de la
// app: lo dispara la barra de navegación global (ver nav-bar.tsx), visible
// en todas las páginas autenticadas.
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
