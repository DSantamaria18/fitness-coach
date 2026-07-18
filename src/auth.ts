import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import { verifyCredentials } from "./lib/verify-credentials";

// Un único usuario, sembrado vía seed script a partir de variables de
// entorno (ADMIN_USERNAME/ADMIN_PASSWORD_HASH) — sin registro público.
// Sesión JWT (sin adapter de Prisma en NextAuth) porque no necesitamos
// persistir sesiones en base de datos para un solo usuario.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }
        return verifyCredentials(prisma, username, password);
      },
    }),
  ],
});
