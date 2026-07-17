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
