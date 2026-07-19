import bcrypt from "bcryptjs";

// Configuración compartida entre playwright.config.ts, global-setup.ts, el
// mock de Anthropic y los propios specs — un único sitio para los puertos y
// credenciales de test, en vez de repetirlos (y desincronizarlos) en cada
// fichero. Todos los valores son ficticios, solo válidos dentro del entorno
// E2E local/CI: nunca apuntan a la API real de Anthropic ni a credenciales
// de producción.

export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

// SQLite propio del run E2E, separado del dev.db normal (ver .gitignore):
// global-setup.ts lo recrea desde cero en cada ejecución para partir de un
// estado conocido (catálogo de ejercicios + usuario admin, sin datos de
// ejecuciones anteriores).
export const E2E_DATABASE_PATH = "e2e/.tmp/e2e.db";
export const E2E_DATABASE_URL = `file:./${E2E_DATABASE_PATH}`;

// Puerto fijo del servidor HTTP que sustituye a api.anthropic.com durante
// los tests (ver e2e/mock-anthropic-server.ts). `page.route()` de Playwright
// no sirve aquí porque las llamadas a Anthropic las hace el servidor de
// Next.js (Server Actions), no el navegador — ver DECISIONS.md 2026-07-19.
export const MOCK_ANTHROPIC_PORT = 4010;
export const MOCK_ANTHROPIC_BASE_URL = `http://127.0.0.1:${MOCK_ANTHROPIC_PORT}`;

// Nunca viaja hacia la API real (ANTHROPIC_BASE_URL siempre apunta al mock
// local en este entorno): solo necesita ser una cadena no vacía para que
// `new Anthropic()` no lance al resolver el método de autenticación.
export const ANTHROPIC_API_KEY = "e2e-mock-anthropic-api-key";

export const AUTH_SECRET = "e2e-test-auth-secret-not-for-production-use";
export const ADMIN_USERNAME = "e2e-tester";
const ADMIN_PASSWORD = "e2e-test-password-1234";

// bcryptjs.hashSync es lo bastante rápido (misma cost factor que
// scripts/hash-password.ts) para calcularse una vez al importar este
// módulo, evitando invocar el script como proceso aparte solo para generar
// un hash de test determinista.
export const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

// Exportado aparte del hash: los specs de login necesitan el password en
// claro para rellenar el formulario, el resto del entorno (seed) solo
// necesita el hash.
export { ADMIN_PASSWORD };
