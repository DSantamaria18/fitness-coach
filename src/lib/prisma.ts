// El paquete exporta la clase como "PrismaLibSql" (no "PrismaLibSQL") en la
// v7.8 instalada — comprobado contra node_modules/@prisma/adapter-libsql,
// no contra la documentación pública (que en algunas versiones anteriores
// mostraba el otro casing).
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatasourceConfig } from "@/lib/prisma-datasource-config";

export { resolveDatasourceConfig } from "@/lib/prisma-datasource-config";
export type { PrismaDatasourceConfig } from "@/lib/prisma-datasource-config";

// Evita agotar el pool de conexiones SQLite por el hot-reload de Next.js en
// desarrollo, reutilizando la misma instancia entre recargas.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaLibSql(resolveDatasourceConfig());

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
