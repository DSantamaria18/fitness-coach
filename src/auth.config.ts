import type { NextAuthConfig } from "next-auth";

// Config "edge-safe": sin providers (usan bcrypt/Prisma, no soportados en
// el runtime edge del middleware) ni el adapter de Prisma. Se combina con
// el provider Credentials en src/auth.ts, que sí corre en runtime Node.
export const authConfig = {
  // Explícito a propósito, en vez de confiar en la autodetección de Auth.js
  // (NextAuth() rellena `config.secret` internamente desde `AUTH_SECRET` si
  // se deja vacío — ver next-auth/lib/env.js, `setEnvDefaults`). Esa
  // autodetección solo se dispara una vez, en el momento en que el módulo
  // `NextAuth(...)` se evalúa; en producción real (Vercel, Next.js 16 +
  // Turbopack) no encontró la variable pese a estar correctamente
  // configurada en el dashboard, y todo login fallaba con
  // `MissingSecret` (ver DECISIONS.md). Al pasarlo aquí explícitamente,
  // `authConfig.secret` ya viene resuelto antes de que `setEnvDefaults` lo
  // toque, para las DOS instancias de NextAuth que consumen este objeto
  // (src/auth.ts vía spread y src/proxy.ts directamente) — sin depender de
  // en qué runtime/momento decide leer `process.env` cada una.
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (isLoginPage) {
        return true;
      }

      return isLoggedIn;
    },
    // Sin esto, `session.user` solo trae los campos estándar (name/email/
    // image) y nunca el id devuelto por `authorize()` — cualquier código que
    // lea `session.user.id` vería siempre `undefined`.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
