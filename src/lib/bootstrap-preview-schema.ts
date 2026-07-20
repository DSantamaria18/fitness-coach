import path from "node:path";
import { createClient } from "@libsql/client";
import { applyPendingMigrations } from "../../scripts/apply-turso-migrations";

// Aplica el esquema de prisma/migrations/ a un fichero SQLite que empieza
// vacío — usado por prisma.ts para poblar /tmp/preview.db en cada cold
// start de un preview deployment de Vercel (ver BL-018): ese fichero no
// existe todavía en ese momento, así que hay que crear el esquema antes de
// servir la primera petición.
//
// Reutiliza applyPendingMigrations() de scripts/apply-turso-migrations.ts
// (misma lógica ya usada para aplicar estos mismos ficheros .sql contra
// Turso) en vez de duplicarla, con @libsql/client — el mismo cliente que ya
// usa @prisma/adapter-libsql en runtime (ver src/lib/prisma.ts) y que ya
// está verificado funcionando en el Vercel real de producción. Se descarta
// deliberadamente better-sqlite3 para esto (aunque sea síncrono y evitaría
// el top-level await de prisma.ts): es un módulo nativo compilado, y
// usarlo en código de runtime de producción reintroduciría exactamente el
// riesgo de compatibilidad de binarios nativos en el runtime serverless de
// Vercel que DECISIONS.md (2026-07-20, rediseño del backup) ya decidió
// evitar del lado de escritura — @libsql/client no tiene ese riesgo sin
// verificar porque ya es la base del adapter de producción.
export async function bootstrapPreviewSchema(fileUrl: string): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
  const client = createClient({ url: fileUrl });

  try {
    await applyPendingMigrations(client, migrationsDir);
  } finally {
    client.close();
  }
}
