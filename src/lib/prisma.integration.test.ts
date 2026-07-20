import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

// A diferencia de prisma.test.ts (que solo verifica qué URL/authToken se
// calculan), esto verifica que un PrismaClient construido con
// @prisma/adapter-libsql funciona de verdad: conecta, aplica el esquema
// real vía `prisma migrate deploy` y ejecuta operaciones CRUD reales — en
// el mismo modo "file:" en el que corren Vitest/Playwright/dev local, sin
// tocar red ni requerir credenciales de Turso (no hay ninguna disponible en
// este entorno, ver DECISIONS.md 2026-07-20). Cubre también la sustitución
// de @prisma/adapter-better-sqlite3: si el nuevo adapter no soportara algo
// que el anterior sí (p.ej. las cascadas de borrado declaradas en
// schema.prisma), un test que solo mockea Prisma nunca lo detectaría.
describe("PrismaClient con @prisma/adapter-libsql (integración real, sin red)", () => {
  let tmpDir: string;
  let databaseUrl: string;
  let prisma: PrismaClient;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prisma-libsql-test-"));
    const dbPath = path.join(tmpDir, "test.db");
    databaseUrl = `file:${dbPath}`;

    // Mismo patrón que e2e/global-setup.ts: se pasa DATABASE_URL explícita
    // por env al subproceso para no depender de (ni poder ser pisado por)
    // un .env real que pudiera existir en el worktree.
    execSync("npx prisma migrate deploy", {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });

    const adapter = new PrismaLibSql({
      url: databaseUrl,
      authToken: undefined,
    });
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("escribe y lee datos reales a través del adapter", async () => {
    const created = await prisma.exercise.create({
      data: { name: "Sentadilla (test adapter libsql)", type: "STRENGTH" },
    });

    const found = await prisma.exercise.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(found.name).toBe("Sentadilla (test adapter libsql)");
    expect(found.type).toBe("STRENGTH");
  });

  it("aplica el borrado en cascada declarado en el esquema (User -> Session -> StrengthEntry -> StrengthSet)", async () => {
    const user = await prisma.user.create({
      data: {
        username: "cascada-test-libsql",
        passwordHash: "hash-de-prueba-no-real",
      },
    });
    const exercise = await prisma.exercise.upsert({
      where: { name: "Peso muerto (test cascada libsql)" },
      update: {},
      create: { name: "Peso muerto (test cascada libsql)", type: "STRENGTH" },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        date: new Date("2026-07-20T00:00:00.000Z"),
        strengthEntries: {
          create: {
            exerciseId: exercise.id,
            order: 0,
            sets: {
              create: { order: 0, reps: 5, weightKg: 100 },
            },
          },
        },
      },
      include: { strengthEntries: { include: { sets: true } } },
    });
    const strengthSetId = session.strengthEntries[0].sets[0].id;

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.session.findUnique({ where: { id: session.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.strengthSet.findUnique({ where: { id: strengthSetId } }),
    ).resolves.toBeNull();
  });
});
