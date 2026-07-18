import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Instancia NextAuth propia (solo con authConfig, sin el provider
// Credentials) para el middleware: éste corre en el runtime Edge, que no
// soporta módulos nativos de Node como bcrypt o el cliente de Prisma que
// usa src/auth.ts. Solo necesita leer/verificar el JWT de sesión.
const { auth } = NextAuth(authConfig);

export default auth;

// Protege todas las rutas salvo login, la API de NextAuth, y los assets
// estáticos/internos de Next.js (que no deben requerir sesión).
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
