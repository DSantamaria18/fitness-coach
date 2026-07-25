import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Instancia NextAuth propia (solo con authConfig, sin el provider
// Credentials) para el middleware: éste corre en el runtime Edge, que no
// soporta módulos nativos de Node como bcrypt o el cliente de Prisma que
// usa src/auth.ts. Solo necesita leer/verificar el JWT de sesión.
const { auth } = NextAuth(authConfig);

export default auth;

// Protege todas las rutas salvo login, la API de NextAuth, el servidor MCP
// (api/mcp), el healthcheck (api/health), el manifest/iconos PWA (BL-026) y
// los assets estáticos/internos de Next.js (que no deben requerir sesión).
//
// manifest.webmanifest/icon/apple-icon quedan fuera por la misma razón que
// favicon.ico: Next los enlaza en el <head> de TODAS las páginas, incluida
// /login — sin esta excepción, el propio favicon del login quedaría detrás
// de un 307 a /login.
//
// api/mcp queda fuera A PROPÓSITO: ningún cliente MCP (la skill
// "sesion-entrenamiento", un chat con el conector configurado) tiene cookie
// de sesión de navegador, así que si esta ruta pasara por aquí,
// `authorized()` (auth.config.ts) la redirigiría siempre a /login con un 307
// antes de que route.ts llegara a comprobar el Bearer token — el propio
// código de verifyBearerToken quedaría inalcanzable. Su única capa de auth
// es el Bearer token verificado dentro de la propia ruta (ver
// ARCHITECTURE.md, sección "Servidor MCP"); no añadas aquí una exigencia de
// sesión para esta ruta, y no quites el check de Bearer de route.ts
// asumiendo que el middleware ya protege algo.
//
// api/health queda fuera por la misma razón: Vercel y los monitores externos
// que lo sondean no llevan cookie de sesión; si pasara por el middleware,
// recibirían un 307 a /login en vez del 200 { status: "ok" } esperado. Es
// seguro exponerlo: no devuelve ningún dato sensible (ver route.ts).
export const config = {
  matcher: [
    "/((?!api/auth|api/mcp|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon).*)",
  ],
};
