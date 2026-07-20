// Módulo puro, sin efectos secundarios (a diferencia de prisma.ts, que además
// instancia el PrismaClient singleton): así prisma/seed.ts puede reutilizar
// esta misma resolución de URL sin arrastrar una segunda conexión de Prisma
// solo por importar la función.
export interface PrismaDatasourceConfig {
  url: string;
  authToken: string | undefined;
}

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
  return { url: env.DATABASE_URL ?? "file:./dev.db", authToken: undefined };
}
