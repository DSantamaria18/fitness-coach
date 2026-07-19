import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import {
  ADMIN_PASSWORD_HASH,
  ADMIN_USERNAME,
  AUTH_SECRET,
  E2E_DATABASE_PATH,
  E2E_DATABASE_URL,
  MOCK_ANTHROPIC_PORT,
} from "./env";
import { startMockAnthropicServer } from "./mock-anthropic-server";

// Recrea el SQLite de E2E desde cero en cada run (en vez de reutilizar el de
// la vez anterior): determinismo por encima de velocidad, dado el tamaño
// pequeño de la suite — así ningún spec depende de qué datos dejó una
// ejecución previa.
function resetE2eDatabase() {
  const dbPath = path.resolve(process.cwd(), E2E_DATABASE_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

// `prisma.config.ts` hace `import "dotenv/config"` antes de leer
// `DATABASE_URL`, pero dotenv nunca sobreescribe una variable ya presente en
// `process.env` — al pasarla aquí explícitamente, un `.env` real en el
// worktree (si existiera) no puede colar sus propios valores de producción
// en el run de E2E.
function runWithE2eEnv(command: string) {
  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      ADMIN_USERNAME,
      ADMIN_PASSWORD_HASH,
      AUTH_SECRET,
    },
  });
}

// Migra y siembra (catálogo de ejercicios + usuario admin de test, ambos
// vía prisma/seed.ts sin tocarlo) contra el SQLite de E2E, y arranca el
// mock de Anthropic (ver mock-anthropic-server.ts) antes de que Playwright
// deje pasar ningún test. El webServer (Next dev, ver playwright.config.ts)
// no toca la base de datos ni Anthropic hasta que un test navega a una ruta
// que lo requiera, así que el orden relativo entre el arranque del
// webServer y este globalSetup no importa: Playwright no deja correr
// ningún test hasta que ambos terminan.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- exigido por la firma de globalSetup, sin uso aquí.
export default async function globalSetup(_config: FullConfig) {
  resetE2eDatabase();
  runWithE2eEnv("npx prisma migrate deploy");
  runWithE2eEnv("npx tsx prisma/seed.ts");

  const mockAnthropicServer =
    await startMockAnthropicServer(MOCK_ANTHROPIC_PORT);

  // Playwright usa el valor de retorno de globalSetup como su propio
  // globalTeardown cuando es una función — evita un fichero
  // global-teardown.ts aparte solo para cerrar este servidor.
  return async () => {
    await mockAnthropicServer.close();
  };
}
