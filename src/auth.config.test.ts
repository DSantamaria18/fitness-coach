import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

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
