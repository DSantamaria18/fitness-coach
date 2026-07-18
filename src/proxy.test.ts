import { describe, expect, it, vi } from "vitest";

// proxy.ts invoca NextAuth(authConfig) en la carga del módulo para construir
// su propia instancia edge-safe (ver comentario en proxy.ts). Se mockea aquí
// igual que el resto de tests mockean "@/auth", para poder importar el
// `config.matcher` real sin arrastrar los internals de next-auth (que en
// este entorno de test rompen la resolución de "next/server" al ejecutarse
// de verdad, algo que ningún otro test dispara porque siempre mockean
// "@/auth"/"next-auth" antes de importar).
vi.mock("next-auth", () => ({
  default: () => ({ auth: vi.fn() }),
}));

const { config } = await import("./proxy");

// Regresión del bug detectado por QA: /api/mcp NO estaba excluido del
// matcher, así que toda petición (con o sin Bearer token válido) recibía
// un 307 a /login del middleware de NextAuth antes de llegar a route.ts —
// verifyBearerToken era código inalcanzable en la práctica. Se testea el
// patrón del matcher directamente como la función pura que es (un negative
// lookahead sobre el pathname), sin necesidad de levantar Next.js: es
// justo lo que faltaba, ya que route.test.ts solo llama a POST()
// directamente, sin pasar nunca por este middleware.
describe("proxy matcher", () => {
  const [pattern] = config.matcher;
  // Next.js aplica este patrón contra el pathname completo (vía su propio
  // compilador interno basado en path-to-regexp, con anclas de inicio/fin),
  // no como una búsqueda de subcadena en cualquier posición. Sin anclar aquí
  // manualmente, `.test()` encuentra coincidencias parciales en posiciones
  // internas del path (p. ej. a partir de la segunda "/" de "/api/auth/x")
  // que no reflejan el comportamiento real del middleware — se ancla para
  // aproximar esa semántica sin reimplementar el compilador interno de Next.
  const matcher = new RegExp(`^${pattern}$`);

  it("excluye /api/mcp y sus subrutas del middleware de sesión", () => {
    expect(matcher.test("/api/mcp")).toBe(false);
    expect(matcher.test("/api/mcp/")).toBe(false);
    expect(matcher.test("/api/mcp/algo")).toBe(false);
  });

  it("sigue excluyendo la API de NextAuth y los assets estáticos", () => {
    expect(matcher.test("/api/auth/callback")).toBe(false);
    expect(matcher.test("/_next/static/chunk.js")).toBe(false);
    expect(matcher.test("/_next/image")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
  });

  it("sigue protegiendo el resto de rutas de la app", () => {
    expect(matcher.test("/")).toBe(true);
    expect(matcher.test("/historial")).toBe(true);
    expect(matcher.test("/peso")).toBe(true);
    expect(matcher.test("/sesion")).toBe(true);
    expect(matcher.test("/ajustes")).toBe(true);
    // Otras rutas de API de la app (pensadas para sesión de navegador, a
    // diferencia de /api/mcp que se autentica con Bearer) siguen exigiendo
    // sesión: no se excluyen aquí a propósito.
    expect(matcher.test("/api/sessions")).toBe(true);
    expect(matcher.test("/api/body-weight")).toBe(true);
  });
});
