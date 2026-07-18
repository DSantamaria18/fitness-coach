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
  genera el cliente Prisma, y corre `format:check`, `lint`, `typecheck`, `test` y `build` (con
  variables de entorno ficticias, solo para que el build pueda arrancar).
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
- Los callbacks `jwt`/`session` de `authConfig` trasladan el `id` devuelto por `authorize()`
  al token y de ahí a `session.user.id` — sin ellos, `session.user` solo trae los campos
  estándar de Auth.js (name/email/image) y cualquier código que dependa de `session.user.id`
  ve siempre `undefined`.

## Registro de peso corporal

- `src/lib/validate-body-weight.ts` — esquema Zod único (peso 20–300 kg, fecha ISO no futura),
  consumido tanto por la ruta API como por la Server Action del formulario.
- `src/lib/create-body-weight.ts` — punto único de persistencia (valida con
  `validate-body-weight.ts` y escribe con Prisma), reutilizado por:
  - `src/app/api/body-weight/route.ts` (`POST`, pensado para el futuro servidor MCP).
  - `src/app/peso/actions.ts` (Server Action del formulario `/peso`).
  Ambos derivan el `userId` de la sesión (`auth()`), nunca del cuerpo de la petición.

## Historial de peso corporal

- `src/lib/get-body-weight-history.ts`, `update-body-weight.ts`, `delete-body-weight.ts` —
  capa de dominio para consultar (con filtro opcional de rango de fechas), editar y borrar
  registros. Las mutaciones comprueban primero, con un `findFirst({ userId, id })`, que el
  registro pertenece al usuario antes de escribir — guarda de autorización a nivel de dominio.
- `src/app/api/body-weight/route.ts` (`GET`) y `src/app/api/body-weight/[id]/route.ts`
  (`PATCH`/`DELETE`) — expuestos igual que el resto de la API, pensados para el futuro
  servidor MCP.
- `src/app/historial/page.tsx` — Server Component que llama a `auth()` y a la capa de dominio
  directamente (sin pasar por la API HTTP), igual que `/peso`. Esto además vuelve la página
  dinámica automáticamente (ver nota de `/sesion` más abajo).

## Registro de sesión de entreno

- `src/lib/validate-session.ts` — esquema Zod (unión discriminada por `tipo`: `fuerza` o
  `cardio`) que valida solo la forma del dato, con el mismo esquema fuerza/reps/tempo/peso/RPE
  y cardio (duración, distancia, velocidad/ritmo medio, frecuencia cardiaca, pasos, kcal —
  todos opcionales) que ya usa la skill "sesion-entrenamiento".
- `src/lib/create-session.ts` — valida forma (Zod), valida existencia del ejercicio en el
  catálogo y que su tipo coincida (contra la base de datos, no en Zod), y persiste `Session`
  junto con sus `StrengthEntry`/`StrengthSet` o `CardioEntry` en una única transacción Prisma
  (`prisma.$transaction`) para evitar sesiones huérfanas si falla la escritura a mitad.
- `src/app/api/sessions/route.ts` (`POST`) y `src/app/sesion/actions.ts` (Server Action)
  comparten `create-session.ts` — mismo patrón que peso/historial de una sola fuente de verdad.
- `src/app/sesion/page.tsx` declara `export const dynamic = "force-dynamic"` explícitamente:
  a diferencia de `/historial`, no llama a `auth()` en el propio Server Component (solo
  necesita el catálogo de ejercicios, no el `userId`), así que sin esta declaración Next
  intentaría prerenderizarla como página estática en build time y fallaría al llamar a la
  base de datos.

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
