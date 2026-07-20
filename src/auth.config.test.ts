import { describe, expect, it, vi } from "vitest";
import { authConfig } from "./auth.config";

// Regresión del bug de producción MissingSecret (login roto en Vercel real,
// ver DECISIONS.md): NextAuth() confía por defecto en su propia
// autodetección de AUTH_SECRET (setEnvDefaults en next-auth/lib/env.js, que
// solo rellena `config.secret` si venía vacío), y esa autodetección no
// encontró la variable en el runtime real pese a estar bien configurada en
// Vercel. Un test que solo comprobara "el login funciona" no habría
// detectado esto: en local/tests/CI, AUTH_SECRET ya llega inyectada al
// proceso (e2e/global-setup.ts, e2e/env.ts), así que el login "funcionaba"
// en tests incluso confiando ciegamente en la autodetección — el bug solo
// era visible en el runtime real de Vercel. Este test verifica la
// CONFIGURACIÓN en sí (que authConfig expone `secret` de forma explícita,
// leído directamente de `process.env.AUTH_SECRET`), no el resultado de un
// login: si alguien retira esa línea, este test debe fallar aunque
// AUTH_SECRET esté presente en el entorno.
describe("authConfig.secret", () => {
  it("se pasa explícitamente desde AUTH_SECRET, sin depender de la autodetección de Auth.js", async () => {
    const valorDePrueba = "test-secret-para-verificar-uso-explicito";
    vi.stubEnv("AUTH_SECRET", valorDePrueba);
    // authConfig lee `process.env.AUTH_SECRET` en el momento en que el
    // módulo se evalúa (nivel superior del fichero) — hace falta reimportar
    // el módulo en caliente para que recoja el valor recién fijado arriba.
    vi.resetModules();

    const { authConfig: authConfigConSecretoDePrueba } =
      await import("./auth.config");

    expect(authConfigConSecretoDePrueba.secret).toBe(valorDePrueba);

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

// Simula las decisiones de NextAuth.js sin arrancar el servidor completo:
// el callback `authorized` es lo único que necesita cubrirse con tests,
// el resto (providers, adapters) se ejerce por verificación manual en
// navegador según exige CLAUDE.md para cambios de UI/flujo de auth.
describe("authConfig.callbacks.authorized", () => {
  const authorized = authConfig.callbacks!.authorized!;

  it("permite el acceso a /login sin sesión", () => {
    const result = authorized({
      auth: null,
      request: { nextUrl: new URL("http://localhost/login") },
    } as never);

    expect(result).toBe(true);
  });

  it("deniega el acceso a una ruta protegida sin sesión", () => {
    const result = authorized({
      auth: null,
      request: { nextUrl: new URL("http://localhost/") },
    } as never);

    expect(result).toBe(false);
  });

  it("permite el acceso a una ruta protegida con sesión", () => {
    const result = authorized({
      auth: { user: { id: "user-1" } },
      request: { nextUrl: new URL("http://localhost/") },
    } as never);

    expect(result).toBe(true);
  });
});

// El id devuelto por `authorize()` solo llega a `session.user.id` si estos
// dos callbacks lo trasladan explícitamente: primero al JWT, luego a la
// sesión. Sin ellos, `session.user` queda vacío (regresión real detectada
// en fase 3 al verificar /peso manualmente).
describe("authConfig.callbacks.jwt / session", () => {
  const jwt = authConfig.callbacks!.jwt!;
  const session = authConfig.callbacks!.session!;

  it("copia el id del usuario autenticado al token en el login", async () => {
    const token = await jwt({
      token: {},
      user: { id: "user-1" },
    } as never);

    expect(token.id).toBe("user-1");
  });

  it("conserva el id del token en llamadas posteriores sin `user`", async () => {
    const token = await jwt({
      token: { id: "user-1" },
      user: undefined,
    } as never);

    expect(token.id).toBe("user-1");
  });

  it("expone el id del token en session.user.id", async () => {
    const result = await session({
      session: { user: {}, expires: "" },
      token: { id: "user-1" },
    } as never);

    expect(result.user.id).toBe("user-1");
  });
});
