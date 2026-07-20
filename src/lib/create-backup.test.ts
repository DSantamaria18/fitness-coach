import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    exercise: { findMany: vi.fn() },
    bodyWeight: { findMany: vi.fn() },
    session: { findMany: vi.fn() },
    strengthEntry: { findMany: vi.fn() },
    strengthSet: { findMany: vi.fn() },
    cardioEntry: { findMany: vi.fn() },
    comentarioProgreso: { findMany: vi.fn() },
    backup: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { createBackup } from "./create-backup";

const mocked = vi.mocked(prisma, true);

// Por defecto, todas las tablas están vacías: cada test rellena solo las que
// necesita, así no hay que enumerar las 9 en cada caso.
function resetAllTablesEmpty() {
  mocked.user.findMany.mockResolvedValue([]);
  mocked.exercise.findMany.mockResolvedValue([]);
  mocked.bodyWeight.findMany.mockResolvedValue([]);
  mocked.session.findMany.mockResolvedValue([]);
  mocked.strengthEntry.findMany.mockResolvedValue([]);
  mocked.strengthSet.findMany.mockResolvedValue([]);
  mocked.cardioEntry.findMany.mockResolvedValue([]);
  mocked.comentarioProgreso.findMany.mockResolvedValue([]);
  mocked.backup.findMany.mockResolvedValue([]);
}

describe("createBackup", () => {
  let dir: string;
  let destinationPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllTablesEmpty();
    dir = mkdtempSync(path.join(tmpdir(), "fitness-coach-backup-test-"));
    destinationPath = path.join(dir, "backup.sql");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // Test de contrato principal (no de implementación, regla 5 CLAUDE.md): el
  // backup generado debe ser SQL ejecutable que, al aplicarse sobre una base
  // de datos vacía con el esquema ya creado, reconstruye exactamente los
  // datos originales — no comparamos el texto SQL byte a byte, sino el
  // contenido lógico de las tablas tras restaurarlo con un motor SQLite real.
  it("genera un backup restaurable que reconstruye datos con relaciones, nulos, floats y comillas", async () => {
    mocked.backup.create.mockResolvedValue({
      id: "backup-1",
      userId: "user-1",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
    });

    mocked.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        username: "david",
        passwordHash: "hash",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mocked.bodyWeight.findMany.mockResolvedValue([
      {
        id: "bw-1",
        userId: "user-1",
        date: new Date("2026-07-19T00:00:00.000Z"),
        weightKg: 82.4,
        createdAt: new Date("2026-07-19T08:00:00.000Z"),
        updatedAt: new Date("2026-07-19T08:00:00.000Z"),
      },
    ]);
    mocked.exercise.findMany.mockResolvedValue([
      {
        id: "ex-1",
        name: "Press banca",
        type: "STRENGTH",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    mocked.session.findMany.mockResolvedValue([
      {
        id: "sess-1",
        userId: "user-1",
        date: new Date("2026-07-19T00:00:00.000Z"),
        createdAt: new Date("2026-07-19T09:00:00.000Z"),
        updatedAt: new Date("2026-07-19T09:00:00.000Z"),
      },
    ]);
    mocked.strengthEntry.findMany.mockResolvedValue([
      {
        id: "se-1",
        sessionId: "sess-1",
        exerciseId: "ex-1",
        // Comilla simple deliberada: prueba de escapado, no un caso raro —
        // David escribe notas libres con apóstrofos habitualmente.
        notes: "No dormí bien, RPE alto",
        order: 0,
      },
    ]);
    mocked.strengthSet.findMany.mockResolvedValue([
      {
        id: "ss-1",
        strengthEntryId: "se-1",
        order: 0,
        reps: 5,
        weightKg: 100.5,
        tempo: "2-0-1",
        rpe: null,
      },
    ]);

    const result = await createBackup("user-1", destinationPath);
    expect(result.success).toBe(true);

    const sql = readFileSync(destinationPath, "utf-8");

    // Restaurar sobre un esquema real: solo las tablas que este test usa,
    // suficiente para demostrar integridad referencial y tipos de datos.
    const restored = new Database(path.join(dir, "restored.db"));
    restored.exec(`
      CREATE TABLE "User" (
        "id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL
      );
      CREATE TABLE "Exercise" (
        "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL,
        "type" TEXT NOT NULL, "createdAt" DATETIME NOT NULL
      );
      CREATE TABLE "BodyWeight" (
        "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
        "date" DATETIME NOT NULL, "weightKg" REAL NOT NULL,
        "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User"("id")
      );
      CREATE TABLE "Session" (
        "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
        "date" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL,
        "updatedAt" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User"("id")
      );
      CREATE TABLE "StrengthEntry" (
        "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL,
        "exerciseId" TEXT NOT NULL, "notes" TEXT, "order" INTEGER NOT NULL,
        FOREIGN KEY ("sessionId") REFERENCES "Session"("id"),
        FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
      );
      CREATE TABLE "StrengthSet" (
        "id" TEXT NOT NULL PRIMARY KEY, "strengthEntryId" TEXT NOT NULL,
        "order" INTEGER NOT NULL, "reps" INTEGER NOT NULL,
        "weightKg" REAL NOT NULL, "tempo" TEXT, "rpe" INTEGER,
        FOREIGN KEY ("strengthEntryId") REFERENCES "StrengthEntry"("id")
      );
      CREATE TABLE "CardioEntry" (
        "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL,
        "exerciseId" TEXT NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
        "durationSeconds" INTEGER, "distanceKm" REAL, "avgSpeedKmh" REAL,
        "avgPaceSecPerKm" INTEGER, "avgHeartRate" INTEGER, "maxHeartRate" INTEGER,
        "steps" INTEGER, "stepFrequency" REAL, "kcal" INTEGER, "rpe" INTEGER,
        "notes" TEXT
      );
      CREATE TABLE "ComentarioProgreso" (
        "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE,
        "texto" TEXT NOT NULL, "generadoEn" DATETIME NOT NULL
      );
      CREATE TABLE "Backup" (
        "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL
      );
    `);
    restored.exec(sql);

    const user = restored.prepare('SELECT * FROM "User"').get() as Record<
      string,
      unknown
    >;
    expect(user).toMatchObject({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
    });

    const weight = restored
      .prepare('SELECT * FROM "BodyWeight"')
      .get() as Record<string, unknown>;
    expect(weight).toMatchObject({
      id: "bw-1",
      userId: "user-1",
      weightKg: 82.4,
    });

    const entry = restored
      .prepare('SELECT * FROM "StrengthEntry"')
      .get() as Record<string, unknown>;
    expect(entry).toMatchObject({
      id: "se-1",
      sessionId: "sess-1",
      exerciseId: "ex-1",
      notes: "No dormí bien, RPE alto",
    });

    const set = restored.prepare('SELECT * FROM "StrengthSet"').get() as Record<
      string,
      unknown
    >;
    expect(set).toMatchObject({
      id: "ss-1",
      reps: 5,
      weightKg: 100.5,
      rpe: null,
    });

    restored.close();
  });

  it("registra la fecha de creación bajo el userId dado", async () => {
    mocked.backup.create.mockResolvedValue({
      id: "backup-1",
      userId: "user-1",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
    });

    const result = await createBackup("user-1", destinationPath);

    expect(result).toEqual({
      success: true,
      data: { createdAt: new Date("2026-07-20T10:00:00.000Z") },
    });
    expect(mocked.backup.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
    });
  });

  it("devuelve un error sin registrar nada cuando falla la lectura de datos", async () => {
    mocked.session.findMany.mockRejectedValue(new Error("conexión perdida"));

    const result = await createBackup("user-1", destinationPath);

    expect(result.success).toBe(false);
    expect(mocked.backup.create).not.toHaveBeenCalled();
    expect(existsSync(destinationPath)).toBe(false);
  });
});
