import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    backup: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createBackup } from "./create-backup";

const createMock = vi.mocked(prisma.backup.create);

describe("createBackup", () => {
  let dir: string;
  let sourcePath: string;
  let destinationPath: string;

  beforeEach(() => {
    createMock.mockReset();
    dir = mkdtempSync(path.join(tmpdir(), "fitness-coach-backup-test-"));
    sourcePath = path.join(dir, "source.db");
    destinationPath = path.join(dir, "backup.db");

    // Fuente real (no un mock): la API de backup online de better-sqlite3
    // necesita un fichero SQLite válido para operar, no solo un mock de
    // Prisma, así que se crea uno mínimo con contenido real.
    const source = new Database(sourcePath);
    source.exec(
      "CREATE TABLE demo (id INTEGER PRIMARY KEY); INSERT INTO demo DEFAULT VALUES;",
    );
    source.close();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("genera un fichero de backup válido y registra la fecha bajo el userId dado", async () => {
    createMock.mockResolvedValue({
      id: "backup-1",
      userId: "user-1",
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
    });

    const result = await createBackup("user-1", destinationPath, sourcePath);

    expect(result.success).toBe(true);
    expect(existsSync(destinationPath)).toBe(true);
    expect(createMock).toHaveBeenCalledWith({ data: { userId: "user-1" } });

    // El fichero generado debe ser una base de datos SQLite legible, no una
    // copia truncada o corrupta.
    const restored = new Database(destinationPath, { readonly: true });
    const row = restored.prepare("SELECT id FROM demo").get() as {
      id: number;
    };
    restored.close();
    expect(row.id).toBe(1);
  });

  it("devuelve un error sin registrar nada cuando la base de datos de origen no existe", async () => {
    const result = await createBackup(
      "user-1",
      destinationPath,
      path.join(dir, "no-existe.db"),
    );

    expect(result.success).toBe(false);
    expect(existsSync(destinationPath)).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});
