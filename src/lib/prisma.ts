// El paquete exporta la clase como "PrismaLibSql" (no "PrismaLibSQL") en la
// v7.8 instalada — comprobado contra node_modules/@prisma/adapter-libsql,
// no contra la documentación pública (que en algunas versiones anteriores
// mostraba el otro casing).
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import {
  PREVIEW_EPHEMERAL_URL,
  resolveDatasourceConfig,
} from "@/lib/prisma-datasource-config";
import { bootstrapPreviewSchema } from "@/lib/bootstrap-preview-schema";

export { resolveDatasourceConfig } from "@/lib/prisma-datasource-config";
export type { PrismaDatasourceConfig } from "@/lib/prisma-datasource-config";

// Evita agotar el pool de conexiones SQLite por el hot-reload de Next.js en
// desarrollo, reutilizando la misma instancia entre recargas. También
// guarda si ya se aplicó el bootstrap del esquema de preview (BL-018, ver
// más abajo): mismo motivo, que no se repita en cada hot-reload/import.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  previewSchemaBootstrapped: boolean | undefined;
};

const datasourceConfig = resolveDatasourceConfig();

// BL-018: /tmp está vacío en cada cold start de la función serverless de
// Vercel, así que si la datasource resuelta es el fallback efímero de
// preview (ver prisma-datasource-config.ts), hay que crear el esquema ahí
// antes de que cualquier query llegue a ejecutarse — de lo contrario la
// primera petición del cold start fallaría con "no such table". Guardado
// con el mismo patrón que el singleton de abajo para que ocurra una única
// vez por instancia, no en cada import. No aplica en producción (Turso) ni
// en local/CI (sin VERCEL_ENV), donde datasourceConfig.url nunca coincide
// con PREVIEW_EPHEMERAL_URL. Top-level await deliberado: bootstrapPreviewSchema
// es async (usa @libsql/client, ver ese fichero para el porqué de no
// elegir una alternativa síncrona), y este módulo solo corre en runtime
// Node.js — nunca en Edge, donde Prisma no es soportado (ver auth.config.ts
// y ARCHITECTURE.md) — así que no hay restricción de bundle que lo impida.
if (
  datasourceConfig.url === PREVIEW_EPHEMERAL_URL &&
  !globalForPrisma.previewSchemaBootstrapped
) {
  await bootstrapPreviewSchema(datasourceConfig.url);
  globalForPrisma.previewSchemaBootstrapped = true;
}

const adapter = new PrismaLibSql(datasourceConfig);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
