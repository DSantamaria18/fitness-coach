import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bootstrapPreviewSchema } from "./bootstrap-preview-schema";

// Contrato verificado (regla 5 CLAUDE.md: comportamiento, no
// implementación interna): dado un fichero SQLite vacío (el estado real de
// /tmp/preview.db en cada cold start serverless, ver BL-018),
// bootstrapPreviewSchema() deja las tablas del esquema creadas y listas
// para aceptar datos — sin importar cómo se lean/apliquen internamente los
// ficheros de prisma/migrations/, un refactor de esa lectura no debería
// romper este test. Se verifica con @libsql/client (no better-sqlite3): es
// el cliente real que usa la función en producción, ver el comentario de
// bootstrap-preview-schema.ts sobre el riesgo de binarios nativos.
describe("bootstrapPreviewSchema", () => {
  let tmpDir: string;
  let dbUrl: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "bootstrap-preview-schema-test-"),
    );
    dbUrl = `file:${path.join(tmpDir, "preview.db")}`;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("crea todas las tablas del esquema en un fichero SQLite que empieza vacío", async () => {
    await bootstrapPreviewSchema(dbUrl);

    const client = createClient({ url: dbUrl });
    try {
      const result = await client.execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      );
      const tables = result.rows.map((row) => String(row.name));

      expect(tables).toEqual(
        expect.arrayContaining([
          "User",
          "BodyWeight",
          "Exercise",
          "Session",
          "StrengthEntry",
          "StrengthSet",
          "CardioEntry",
          "Backup",
        ]),
      );
    } finally {
      client.close();
    }
  });

  it("las tablas creadas aceptan escritura y lectura reales, no solo existen vacías", async () => {
    await bootstrapPreviewSchema(dbUrl);

    const client = createClient({ url: dbUrl });
    try {
      await client.execute({
        sql: `INSERT INTO "User" (id, username, passwordHash) VALUES (?, ?, ?)`,
        args: ["user-1", "david-test", "hash-de-prueba"],
      });

      const result = await client.execute({
        sql: `SELECT username FROM "User" WHERE id = ?`,
        args: ["user-1"],
      });

      expect(result.rows[0]?.username).toBe("david-test");
    } finally {
      client.close();
    }
  });

  it("aplica las migraciones en orden cronológico, incluidas las posteriores al esquema inicial", async () => {
    await bootstrapPreviewSchema(dbUrl);

    // "order" en CardioEntry lo añade la migración más reciente
    // (20260719182225_add_cardio_entry_order) sobre una tabla ya creada por
    // la migración inicial — solo existe si se aplicaron todas en orden, no
    // solo la primera.
    const client = createClient({ url: dbUrl });
    try {
      const result = await client.execute(`PRAGMA table_info("CardioEntry")`);
      const columns = result.rows.map((row) => String(row.name));

      expect(columns).toContain("order");
    } finally {
      client.close();
    }
  });
});
