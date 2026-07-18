import Database from "better-sqlite3";
import { prisma } from "@/lib/prisma";

export type CreateBackupResult =
  | { success: true; data: { createdAt: Date } }
  | { success: false; error: string };

function resolveDatabasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return url.replace(/^file:/, "");
}

// Usa la API de backup online de better-sqlite3 (copia consistente incluso
// con escrituras concurrentes) en vez de copiar el fichero a bajo nivel;
// sourcePath es inyectable para poder testear contra un fichero temporal en
// lugar del DATABASE_URL real.
export async function createBackup(
  userId: string,
  destinationPath: string,
  sourcePath: string = resolveDatabasePath(),
): Promise<CreateBackupResult> {
  let db: Database.Database;
  try {
    db = new Database(sourcePath, { readonly: true });
  } catch {
    return { success: false, error: "No se pudo abrir la base de datos." };
  }

  try {
    await db.backup(destinationPath);
  } catch {
    return { success: false, error: "No se pudo generar el backup." };
  } finally {
    db.close();
  }

  const backup = await prisma.backup.create({ data: { userId } });
  return { success: true, data: { createdAt: backup.createdAt } };
}
