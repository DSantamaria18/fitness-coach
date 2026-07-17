# Arquitectura

Descripción de la arquitectura de la aplicación. Se completa incrementalmente a medida que
avanza el roadmap de implementación (ver plan de fases acordado).

## Stack técnico

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript estricto.
- **Estilos**: Tailwind CSS v4 (mobile-first).
- **Persistencia**: SQLite, accedida vía Prisma ORM (generador `prisma-client`, cliente TS en
  `src/generated/prisma/`, no committeado — se regenera con `npm run prisma:generate`).
  Conexión mediante el driver adapter `@prisma/adapter-better-sqlite3` (Prisma 7 requiere un
  adapter explícito; no hay motor Rust embebido por defecto).
- **Validación**: Zod (compartirá esquemas entre rutas API web y tools MCP en fases futuras).
- **Testing**: Vitest (unit + integración) + Testing Library (componentes) + jsdom.
- **Lint/formato**: ESLint (`eslint-config-next`) + Prettier. Los ficheros Markdown de
  documentación (`*.md`) están excluidos del autoformateo (`.prettierignore`) porque se editan
  a mano y Prettier reescribe su estructura de forma indeseada.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — en cada push/PR: instala dependencias,
  genera el cliente Prisma, y corre `format:check`, `lint`, `typecheck` y `test`.
- **Autenticación**: Auth.js (NextAuth) v5, provider Credentials + bcrypt. Usuario único
  sembrado desde `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` (ver `prisma/seed.ts` y
  `scripts/hash-password.ts`). Sesión JWT en cookie httpOnly (`AUTH_SECRET`), sin adapter de
  base de datos en NextAuth (no hace falta persistir sesiones para un solo usuario).

## Autenticación y protección de rutas

- `src/auth.config.ts` — config "edge-safe" (sin providers ni módulos nativos de Node):
  define la página de login y el callback `authorized`, que decide si una ruta requiere
  sesión. Es la parte testeable sin arrancar Auth.js completo.
- `src/auth.ts` — combina `authConfig` con el provider Credentials (usa bcrypt y Prisma, solo
  corre en runtime Node). Expone `handlers`, `auth`, `signIn`, `signOut`.
- `src/proxy.ts` — convención de Next.js 16 para lo que antes era `middleware.ts`. Crea su
  propia instancia de NextAuth a partir de `authConfig` (sin el provider Credentials) porque
  corre en runtime Edge, que no soporta bcrypt ni el cliente de Prisma. Protege todas las
  rutas salvo `/login`, `/api/auth/*` y los assets estáticos de Next.js.
- `src/lib/verify-credentials.ts` — lógica pura de verificación de usuario/contraseña,
  desacoplada de Auth.js para poder testearla con un mock simple.

## Estructura de carpetas relevante

- `src/app/` — rutas y páginas (App Router de Next.js).
- `src/lib/prisma.ts` — instancia singleton del cliente Prisma (evita agotar conexiones SQLite
  por hot-reload en desarrollo).
- `prisma/schema.prisma` — esquema de dominio (ver SPEC.md §3 para la definición funcional).
- `prisma/migrations/` — migraciones versionadas.
- `prisma/seed.ts` — siembra el catálogo cerrado de ejercicios (`npm run prisma:seed`).

## Pendiente de definir en fases futuras del roadmap

- Servidor MCP, gráficos de progreso, Dockerfile/despliegue en Fly.io, backup diario — ver el
  plan de fases y BACKLOG.md.
