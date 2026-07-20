import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  MIGRATIONS_CONTROL_TABLE,
} from "./apply-turso-migrations";

const REPO_ROOT = path.resolve(__dirname, "..");

function writeMigration(
  migrationsDir: string,
  name: string,
  sql: string,
): void {
  const dir = path.join(migrationsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "migration.sql"), sql);
}

// Contrato verificado aquí (regla 5 CLAUDE.md: comportamiento, no
// implementación interna): dado un directorio de migraciones de Prisma
// (carpetas con migration.sql, como ya genera `prisma migrate dev`) y un
// cliente libSQL cualquiera, applyPendingMigrations aplica las que faltan y
// es idempotente en reintentos — sin depender de que sea Turso real ni de
// tener el CLI `turso` instalado (ver DECISIONS.md 2026-07-20: ni
// `migrate deploy` ni `db push` hablan el protocolo HTTP de libSQL remoto).
describe("applyPendingMigrations", () => {
  let tmpDir: string;
  let migrationsDir: string;
  let client: Client;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "apply-turso-migrations-test-"),
    );
    migrationsDir = path.join(tmpDir, "migrations");
    fs.mkdirSync(migrationsDir);
    client = createClient({ url: `file:${path.join(tmpDir, "test.db")}` });
  });

  afterEach(() => {
    client.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("aplica todas las migraciones pendientes en orden cronológico (prefijo timestamp)", async () => {
    writeMigration(
      migrationsDir,
      "20260101000000_create_foo",
      'CREATE TABLE "Foo" ("id" TEXT NOT NULL PRIMARY KEY);',
    );
    writeMigration(
      migrationsDir,
      "20260102000000_create_bar",
      'CREATE TABLE "Bar" ("id" TEXT NOT NULL PRIMARY KEY);',
    );

    const result = await applyPendingMigrations(client, migrationsDir);

    expect(result.applied).toEqual([
      "20260101000000_create_foo",
      "20260102000000_create_bar",
    ]);
    expect(result.skipped).toEqual([]);

    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Foo', 'Bar')",
    );
    expect(tables.rows.map((row) => row.name).sort()).toEqual(["Bar", "Foo"]);
  });

  it("es idempotente: una segunda ejecución no reaplica ni falla", async () => {
    writeMigration(
      migrationsDir,
      "20260101000000_create_foo",
      'CREATE TABLE "Foo" ("id" TEXT NOT NULL PRIMARY KEY);',
    );

    await applyPendingMigrations(client, migrationsDir);
    const second = await applyPendingMigrations(client, migrationsDir);

    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["20260101000000_create_foo"]);

    const controlRows = await client.execute(
      `SELECT migration_name FROM ${MIGRATIONS_CONTROL_TABLE}`,
    );
    expect(controlRows.rows).toHaveLength(1);
  });

  it("solo aplica las migraciones nuevas añadidas después de una ejecución previa", async () => {
    writeMigration(
      migrationsDir,
      "20260101000000_create_foo",
      'CREATE TABLE "Foo" ("id" TEXT NOT NULL PRIMARY KEY);',
    );
    await applyPendingMigrations(client, migrationsDir);

    writeMigration(
      migrationsDir,
      "20260102000000_create_bar",
      'CREATE TABLE "Bar" ("id" TEXT NOT NULL PRIMARY KEY);',
    );
    const result = await applyPendingMigrations(client, migrationsDir);

    expect(result.applied).toEqual(["20260102000000_create_bar"]);
    expect(result.skipped).toEqual(["20260101000000_create_foo"]);
  });

  it("si una migración falla, no la marca como aplicada y deja las anteriores intactas para poder reintentar", async () => {
    writeMigration(
      migrationsDir,
      "20260101000000_create_foo",
      'CREATE TABLE "Foo" ("id" TEXT NOT NULL PRIMARY KEY);',
    );
    writeMigration(
      migrationsDir,
      "20260102000000_broken",
      "ESTO NO ES SQL VALIDO;",
    );

    await expect(
      applyPendingMigrations(client, migrationsDir),
    ).rejects.toThrow();

    const controlRows = await client.execute(
      `SELECT migration_name FROM ${MIGRATIONS_CONTROL_TABLE}`,
    );
    expect(controlRows.rows.map((row) => row.migration_name)).toEqual([
      "20260101000000_create_foo",
    ]);

    // Al arreglar la migración rota y reintentar, la primera no se
    // reaplica (ya estaba marcada) y solo se procesa la segunda.
    writeMigration(
      migrationsDir,
      "20260102000000_broken",
      'CREATE TABLE "Bar" ("id" TEXT NOT NULL PRIMARY KEY);',
    );
    const retry = await applyPendingMigrations(client, migrationsDir);
    expect(retry.applied).toEqual(["20260102000000_broken"]);
    expect(retry.skipped).toEqual(["20260101000000_create_foo"]);
  });
});

// Verifica el contrato de invocación real documentado en la cabecera del
// script (el que usará el TechOps Engineer desde CI): que se puede llamar
// como `npx tsx scripts/apply-turso-migrations.ts` con TURSO_DATABASE_URL
// apuntando a cualquier target libSQL, y que aplica el esquema real del
// proyecto (prisma/migrations, sin fixtures) de principio a fin.
describe("CLI scripts/apply-turso-migrations.ts", () => {
  let tmpDir: string;
  let databaseUrl: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "apply-turso-migrations-cli-test-"),
    );
    databaseUrl = `file:${path.join(tmpDir, "test.db")}`;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Timeout ampliado (por defecto 5000ms): cada llamada arranca un proceso
  // `tsx` nuevo (transpila TS al vuelo) y aquí se invoca dos veces en
  // serie para probar la idempotencia real del binario, no solo de la
  // función interna — más lento que el resto de tests de este fichero,
  // pero es la única forma de verificar el contrato de invocación real
  // documentado en la cabecera del script.
  it("aplica el esquema real del proyecto contra un fichero libSQL nuevo y es idempotente al reinvocarse", () => {
    const runScript = () =>
      execFileSync("npx", ["tsx", "scripts/apply-turso-migrations.ts"], {
        cwd: REPO_ROOT,
        env: { ...process.env, TURSO_DATABASE_URL: databaseUrl },
        stdio: "pipe",
      }).toString();

    const firstRunOutput = runScript();
    expect(firstRunOutput).toMatch(/aplicad/i);

    const client = createClient({ url: databaseUrl });

    const secondRunOutput = runScript();
    expect(secondRunOutput).toMatch(/aplicad/i);

    return client
      .execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'",
      )
      .then((result) => {
        expect(result.rows).toHaveLength(1);
        client.close();
      });
  }, 20000);
});
