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
