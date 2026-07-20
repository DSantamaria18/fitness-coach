import { describe, expect, it } from "vitest";
import {
  PREVIEW_EPHEMERAL_URL,
  resolveDatasourceConfig,
} from "./prisma-datasource-config";

// prisma.test.ts ya cubre el contrato base (prioridad TURSO_* sobre
// DATABASE_URL, sin ramificar por NODE_ENV). Este fichero cubre solo la
// rama nueva de BL-018: un preview de Vercel nunca recibe TURSO_* (scope
// Production-only en el dashboard, guardrail deliberado — ver
// DECISIONS.md), así que sin esta rama caería en silencio a
// "file:./dev.db", un fichero que no existe/no persiste en el runtime
// serverless. VERCEL_ENV es la única señal disponible para distinguir
// "preview sin credenciales, a propósito" de "producción sin credenciales,
// por error de configuración".
describe("resolveDatasourceConfig — SQLite efímero en preview sin Turso (BL-018)", () => {
  it("VERCEL_ENV=preview sin TURSO_DATABASE_URL usa el SQLite efímero de /tmp", () => {
    const config = resolveDatasourceConfig({ VERCEL_ENV: "preview" });

    expect(config).toEqual({
      url: PREVIEW_EPHEMERAL_URL,
      authToken: undefined,
    });
  });

  it("VERCEL_ENV=development (Vercel dev, no producción) sin TURSO_DATABASE_URL también usa el fallback efímero", () => {
    const config = resolveDatasourceConfig({ VERCEL_ENV: "development" });

    expect(config).toEqual({
      url: PREVIEW_EPHEMERAL_URL,
      authToken: undefined,
    });
  });

  it("VERCEL_ENV=production sin TURSO_DATABASE_URL sigue cayendo a DATABASE_URL/file:./dev.db (sin cambios)", () => {
    expect(resolveDatasourceConfig({ VERCEL_ENV: "production" })).toEqual({
      url: "file:./dev.db",
      authToken: undefined,
    });

    expect(
      resolveDatasourceConfig({
        VERCEL_ENV: "production",
        DATABASE_URL: "file:./e2e/.tmp/e2e.db",
      }),
    ).toEqual({ url: "file:./e2e/.tmp/e2e.db", authToken: undefined });
  });

  it("VERCEL_ENV=production con TURSO_DATABASE_URL usa Turso (sin cambios)", () => {
    const config = resolveDatasourceConfig({
      VERCEL_ENV: "production",
      TURSO_DATABASE_URL: "libsql://fitness-coach-david.turso.io",
      TURSO_AUTH_TOKEN: "un-token-real",
    });

    expect(config).toEqual({
      url: "libsql://fitness-coach-david.turso.io",
      authToken: "un-token-real",
    });
  });

  it("prioriza TURSO_DATABASE_URL sobre el fallback efímero aunque VERCEL_ENV no sea producción", () => {
    // Hoy Vercel nunca inyecta TURSO_* en un preview (scope Production-only
    // a propósito), pero si esa configuración cambiara alguna vez, unas
    // credenciales reales presentes deben ganar siempre al fallback de
    // /tmp — la rama de preview solo cubre la ausencia de credenciales.
    const config = resolveDatasourceConfig({
      VERCEL_ENV: "preview",
      TURSO_DATABASE_URL: "libsql://preview-con-turso.turso.io",
    });

    expect(config).toEqual({
      url: "libsql://preview-con-turso.turso.io",
      authToken: undefined,
    });
  });

  it("sin VERCEL_ENV definida (local/CI) el comportamiento no cambia, con o sin TURSO_DATABASE_URL/DATABASE_URL", () => {
    expect(resolveDatasourceConfig({})).toEqual({
      url: "file:./dev.db",
      authToken: undefined,
    });

    expect(
      resolveDatasourceConfig({ DATABASE_URL: "file:./e2e/.tmp/e2e.db" }),
    ).toEqual({ url: "file:./e2e/.tmp/e2e.db", authToken: undefined });

    expect(
      resolveDatasourceConfig({
        TURSO_DATABASE_URL: "libsql://fitness-coach-david.turso.io",
        TURSO_AUTH_TOKEN: "un-token-real",
      }),
    ).toEqual({
      url: "libsql://fitness-coach-david.turso.io",
      authToken: "un-token-real",
    });
  });
});
