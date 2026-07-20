// Aplica las migraciones de prisma/migrations/ (generadas en local con
// `prisma migrate dev`, ese flujo no cambia) contra cualquier target
// libSQL: la Turso real de producción, o un `libsql-server` efímero en CI.
// Ni `prisma migrate deploy`, ni `db push`, ni `migrate dev` funcionan
// directamente contra una URL libSQL remota — confirmado contra la
// documentación oficial de Prisma y Turso (libSQL remoto habla HTTP, un
// protocolo que Prisma Migrate no soporta) — así que aplicamos el SQL
// crudo de cada migración nosotros mismos, vía @libsql/client (el mismo
// cliente que usa @prisma/adapter-libsql en runtime, ver src/lib/prisma.ts:
// evita depender de tener el binario `turso` instalado en el runner de CI).
// Ver DECISIONS.md 2026-07-20 para el contexto completo del pivote.
//
// Uso:
//   TURSO_DATABASE_URL=<url> [TURSO_AUTH_TOKEN=<token>] \
//     npx tsx scripts/apply-turso-migrations.ts
//
// Variables de entorno:
//   TURSO_DATABASE_URL (obligatoria) — el target libSQL contra el que se
//     aplican las migraciones. Mismo nombre que usa el propio cliente
//     Prisma de la app (src/lib/prisma.ts) porque es el mismo concepto: el
//     target libSQL con el que se está operando en cada paso.
//       - En CI, apunta al `libsql-server` efímero levantado para verificar
//         la migración antes de tocar producción (ej. "http://127.0.0.1:8080").
//       - En el paso de despliegue real, apunta a la Turso de producción
//         (ej. "libsql://fitness-coach-david.turso.io").
//   TURSO_AUTH_TOKEN (opcional) — token de autenticación. Vacío/ausente
//     para el `libsql-server` local de CI (sin autenticación configurada);
//     obligatorio contra la Turso real.
//
// Idempotencia: ver el comentario junto a MIGRATIONS_CONTROL_TABLE más
// abajo — no se puede reutilizar `_prisma_migrations` (esa tabla asume que
// fue el propio CLI de Prisma quien aplicó cada migración, con sus propios
// checksums; aquí el SQL se aplica a mano).
import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

// Tabla de control propia (en vez de replicar `_prisma_migrations`, cuyo
// formato de checksums es un detalle interno no documentado como API
// pública de Prisma y podría cambiar entre versiones): solo necesitamos
// saber qué carpetas de prisma/migrations/ ya se aplicaron a este target
// concreto, nada más — ni `prisma migrate status` ni ninguna otra orden de
// Prisma CLI pueden usarse contra Turso remoto de todas formas (ver
// cabecera de este fichero), así que no hay beneficio real en imitar su
// esquema exacto.
export const MIGRATIONS_CONTROL_TABLE = "_turso_migrations_applied";

async function ensureControlTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_CONTROL_TABLE} (
      migration_name TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

async function getAppliedMigrationNames(client: Client): Promise<Set<string>> {
  const result = await client.execute(
    `SELECT migration_name FROM ${MIGRATIONS_CONTROL_TABLE}`,
  );
  return new Set(result.rows.map((row) => String(row.migration_name)));
}

// El prefijo timestamp de Prisma (YYYYMMDDHHMMSS_nombre) hace que el orden
// alfabético de las carpetas coincida con el orden cronológico real de
// generación — mismo criterio que usa el propio Prisma CLI.
function listMigrationDirs(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export interface ApplyMigrationsResult {
  applied: string[];
  skipped: string[];
}

// Aplica en orden las migraciones que aún no estén en la tabla de control.
// Cada migración se marca como aplicada inmediatamente después de
// ejecutarse con éxito (no al final del lote): si una falla a mitad de
// camino, las anteriores quedan correctamente marcadas y un reintento
// posterior no las vuelve a tocar, solo retoma desde la que falló.
export async function applyPendingMigrations(
  client: Client,
  migrationsDir: string,
): Promise<ApplyMigrationsResult> {
  await ensureControlTable(client);
  const alreadyApplied = await getAppliedMigrationNames(client);
  const allMigrations = listMigrationDirs(migrationsDir);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const name of allMigrations) {
    if (alreadyApplied.has(name)) {
      skipped.push(name);
      continue;
    }

    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    try {
      // executeMultiple: pensado explícitamente por @libsql/client para
      // scripts SQL existentes de varias sentencias separadas por ";" (el
      // formato que genera `prisma migrate dev`) — a diferencia de
      // `batch()`, no envuelve las sentencias en una transacción implícita
      // (el SQL de Prisma no la necesita: son DDL secuenciales).
      await client.executeMultiple(sql);
    } catch (error) {
      throw new Error(
        `Fallo aplicando la migración "${name}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }

    await client.execute({
      sql: `INSERT INTO ${MIGRATIONS_CONTROL_TABLE} (migration_name, applied_at) VALUES (?, ?)`,
      args: [name, new Date().toISOString()],
    });
    applied.push(name);
  }

  return { applied, skipped };
}

// Solo se ejecuta como CLI cuando el fichero se invoca directamente (`npx
// tsx scripts/apply-turso-migrations.ts`), nunca al importarlo desde el
// test — así el test puede reutilizar applyPendingMigrations() contra un
// cliente/directorio de fixtures sin heredar el process.exit() de aquí.
const isMainModule = process.argv[1]
  ? import.meta.url === `file://${path.resolve(process.argv[1])}`
  : false;

if (isMainModule) {
  void main();
}

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error(
      "TURSO_DATABASE_URL es obligatoria. Uso: TURSO_DATABASE_URL=<url> [TURSO_AUTH_TOKEN=<token>] npx tsx scripts/apply-turso-migrations.ts",
    );
    process.exit(1);
  }

  const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const result = await applyPendingMigrations(client, migrationsDir);
    console.log(
      `Migraciones aplicadas: ${result.applied.length}${
        result.applied.length ? ` (${result.applied.join(", ")})` : ""
      }`,
    );
    console.log(
      `Migraciones ya aplicadas previamente (omitidas): ${result.skipped.length}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    client.close();
  }
}
