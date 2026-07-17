import type { NextAuthConfig } from "next-auth";

// Config "edge-safe": sin providers (usan bcrypt/Prisma, no soportados en
// el runtime edge del middleware) ni el adapter de Prisma. Se combina con
// el provider Credentials en src/auth.ts, que sí corre en runtime Node.
export const authConfig = {
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
  },
  providers: [],
} satisfies NextAuthConfig;
