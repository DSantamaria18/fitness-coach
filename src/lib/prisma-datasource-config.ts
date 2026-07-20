// Módulo puro, sin efectos secundarios (a diferencia de prisma.ts, que además
// instancia el PrismaClient singleton): así prisma/seed.ts puede reutilizar
// esta misma resolución de URL sin arrastrar una segunda conexión de Prisma
// solo por importar la función.
export interface PrismaDatasourceConfig {
  url: string;
  authToken: string | undefined;
}

// Fichero SQLite en /tmp (el único directorio escribible de una función
// serverless de Vercel) usado como fallback para preview deployments que
// no reciben credenciales de Turso — ver el comentario junto a la rama de
// VERCEL_ENV más abajo y DECISIONS.md. Exportado para que
// bootstrap-preview-schema.ts (src/lib/prisma.ts) pueda detectar sin
// ambigüedad cuándo aplicar el bootstrap del esquema, sin duplicar el
// string mágico.
export const PREVIEW_EPHEMERAL_URL = "file:/tmp/preview.db";

// Un único adapter (@prisma/adapter-libsql) sirve tanto para producción
// (Turso remoto, URL "libsql://...") como para local/tests (fichero SQLite,
// URL "file:...") porque libSQL habla el mismo protocolo de cliente en
// ambos casos — confirmado contra la documentación oficial de Prisma y
// Turso, ver DECISIONS.md 2026-07-20. Prioridad explícita de
// TURSO_DATABASE_URL sobre DATABASE_URL (en vez de ramificar por NODE_ENV)
// para que el comportamiento sea el mismo determinismo que ya usan
// Vitest/Playwright: solo depende de qué variables están definidas, nunca
// de en qué modo cree Next.js que está corriendo.
export function resolveDatasourceConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): PrismaDatasourceConfig {
  const tursoUrl = env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return { url: tursoUrl, authToken: env.TURSO_AUTH_TOKEN };
  }

  // Excepción documentada a "agnóstico de entorno" (ver DECISIONS.md
  // 2026-07-20, entrada de esta misma fecha sobre BL-018): las credenciales
  // de Turso tienen scope Production-only en Vercel a propósito, así que un
  // preview deployment nunca las recibe — sin esta rama, caería en
  // silencio a "file:./dev.db", un fichero que en el runtime serverless de
  // Vercel normalmente no existe/no persiste (el peor caso posible: ni
  // falla con mensaje claro, ni es una decisión consciente). VERCEL_ENV es
  // la única señal disponible para distinguir "preview sin credenciales, a
  // propósito" de "producción sin credenciales, por error de
  // configuración" — sin ramificar aquí, ambos casos serían
  // indistinguibles y un preview mal configurado en producción pasaría
  // desapercibido.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    return { url: PREVIEW_EPHEMERAL_URL, authToken: undefined };
  }

  return { url: env.DATABASE_URL ?? "file:./dev.db", authToken: undefined };
}
