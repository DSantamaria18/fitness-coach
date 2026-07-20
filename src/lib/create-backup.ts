import { writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";

export type CreateBackupResult =
  | { success: true; data: { createdAt: Date } }
  | { success: false; error: string };

// Orden de volcado: cada tabla aparece después de aquellas de las que
// depende por clave foránea (User/Exercise primero, StrengthSet al final de
// su cadena, etc.), para que el SQL generado se pueda restaurar tal cual —
// ejecutando los INSERT en el mismo orden — sin violar integridad
// referencial. No incluye `_prisma_migrations`: esto es un backup de datos
// de usuario, no del histórico de migraciones (ver SPEC.md §8, ese problema
// se resuelve por otra vía: SQL de migración verificado en CI y aplicado a
// mano con `turso db shell`).
const TABLE_DUMPERS: ReadonlyArray<{
  table: string;
  rows: () => Promise<unknown[]>;
}> = [
  { table: "User", rows: () => prisma.user.findMany() },
  { table: "Exercise", rows: () => prisma.exercise.findMany() },
  { table: "BodyWeight", rows: () => prisma.bodyWeight.findMany() },
  { table: "Session", rows: () => prisma.session.findMany() },
  { table: "StrengthEntry", rows: () => prisma.strengthEntry.findMany() },
  { table: "StrengthSet", rows: () => prisma.strengthSet.findMany() },
  { table: "CardioEntry", rows: () => prisma.cardioEntry.findMany() },
  {
    table: "ComentarioProgreso",
    rows: () => prisma.comentarioProgreso.findMany(),
  },
  { table: "Backup", rows: () => prisma.backup.findMany() },
];

// Serializa un valor JS a su literal SQL. Lanza en vez de silenciar tipos
// inesperados: un valor mal serializado produciría un backup que parece
// válido pero restaura datos corruptos o trunca la sentencia — preferible
// que `createBackup` falle con un error claro a que devuelva un fichero que
// solo se descubre roto en el momento del restore.
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Valor numérico no serializable en backup: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "string") {
    // Escapado SQL estándar: una comilla simple se duplica. Los campos de
    // notas libres (StrengthEntry.notes, CardioEntry.notes...) son texto
    // introducido por David y contienen apóstrofos con normalidad.
    return `'${value.replace(/'/g, "''")}'`;
  }
  throw new Error(`Tipo de dato no soportado en backup: ${typeof value}`);
}

function insertStatement(table: string, row: Record<string, unknown>): string {
  const columns = Object.keys(row);
  const values = columns.map((column) => sqlLiteral(row[column]));
  return `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`;
}

// Genera el volcado como sentencias SQL de solo datos (INSERT), no como un
// fichero .db binario: evita depender de la API de backup a bajo nivel de
// better-sqlite3 (inservible contra Turso, donde no hay fichero local que
// abrir) y del CLI de Turso (`turso db export`/`db shell .dump`, que exige
// el binario nativo — inviable en una función serverless de Vercel sin
// empaquetarlo, ver DECISIONS.md). Al apoyarse solo en el cliente Prisma, el
// mismo código funciona igual en local (SQLite de fichero) y en producción
// (Turso), sin ramas de código por entorno. Asume que el esquema ya existe
// en el destino (ver SPEC.md §8, migraciones ya resueltas por otra vía).
async function buildDump(): Promise<string> {
  const statements = [
    `-- Backup de datos de fitness-coach generado el ${new Date().toISOString()}`,
    "-- Solo datos (INSERT): requiere que el esquema ya esté aplicado en el destino.",
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
  ];

  for (const { table, rows } of TABLE_DUMPERS) {
    const data = await rows();
    for (const row of data) {
      statements.push(insertStatement(table, row as Record<string, unknown>));
    }
  }

  statements.push("COMMIT;", "PRAGMA foreign_keys=ON;");
  return statements.join("\n");
}

export async function createBackup(
  userId: string,
  destinationPath: string,
): Promise<CreateBackupResult> {
  let sql: string;
  try {
    sql = await buildDump();
  } catch {
    return { success: false, error: "No se pudo generar el backup." };
  }

  try {
    await writeFile(destinationPath, sql, "utf-8");
  } catch {
    return {
      success: false,
      error: "No se pudo escribir el fichero de backup.",
    };
  }

  const backup = await prisma.backup.create({ data: { userId } });
  return { success: true, data: { createdAt: backup.createdAt } };
}
