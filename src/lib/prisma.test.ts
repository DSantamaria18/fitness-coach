import { describe, expect, it } from "vitest";
import { resolveDatasourceConfig } from "./prisma";

// Contrato: qué URL/authToken usa el cliente Prisma según las variables de
// entorno presentes, no cómo se instancia PrismaLibSQL internamente — así
// un refactor interno del adapter no rompe este test (regla 5 CLAUDE.md).
// Ver DECISIONS.md 2026-07-20 (adapter único @prisma/adapter-libsql) para
// el porqué de esta prioridad TURSO_* > DATABASE_URL en vez de ramificar
// por NODE_ENV.
describe("resolveDatasourceConfig", () => {
  it("usa TURSO_DATABASE_URL y TURSO_AUTH_TOKEN cuando están presentes (producción)", () => {
    const config = resolveDatasourceConfig({
      TURSO_DATABASE_URL: "libsql://fitness-coach-david.turso.io",
      TURSO_AUTH_TOKEN: "un-token-real",
      DATABASE_URL: "file:./dev.db",
    });

    expect(config).toEqual({
      url: "libsql://fitness-coach-david.turso.io",
      authToken: "un-token-real",
    });
  });

  it("cae a DATABASE_URL sin authToken cuando no hay TURSO_DATABASE_URL (local/tests)", () => {
    const config = resolveDatasourceConfig({
      DATABASE_URL: "file:./e2e/.tmp/e2e.db",
    });

    expect(config).toEqual({
      url: "file:./e2e/.tmp/e2e.db",
      authToken: undefined,
    });
  });

  it("usa file:./dev.db por defecto cuando no hay ninguna variable definida", () => {
    const config = resolveDatasourceConfig({});

    expect(config).toEqual({
      url: "file:./dev.db",
      authToken: undefined,
    });
  });

  it("ignora TURSO_AUTH_TOKEN si TURSO_DATABASE_URL no está presente", () => {
    const config = resolveDatasourceConfig({
      TURSO_AUTH_TOKEN: "token-huerfano-sin-url",
      DATABASE_URL: "file:./dev.db",
    });

    expect(config).toEqual({
      url: "file:./dev.db",
      authToken: undefined,
    });
  });
});
