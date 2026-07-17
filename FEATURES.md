# Features implementadas

Funcionalidades ya implementadas y desplegadas, con su descripción. Se actualiza en cada
cambio relevante.

## Andamiaje del proyecto (sin funcionalidad de producto todavía)

- Proyecto Next.js + TypeScript operativo, con Prisma/SQLite modelando el dominio completo de
  SPEC.md §3 y migración inicial aplicada.
- Catálogo de ejercicios sembrado (`npm run prisma:seed`).
- Suite de tests (Vitest) y pipeline de CI (GitHub Actions) verificando formato, lint,
  typecheck y tests en cada push.
- Endpoint `/api/health` para verificar que el servidor está vivo (uso interno/CI, no es un
  caso de uso de producto).

## Login

- Autenticación con usuario/contraseña (Auth.js con provider Credentials, hash bcrypt).
  Usuario único sembrado desde variables de entorno (`ADMIN_USERNAME`,
  `ADMIN_PASSWORD_HASH`) — sin registro público. `npm run hash-password -- "..."` genera el
  hash sin guardar el password en claro en ningún fichero.
- Todas las rutas están protegidas salvo `/login` y la API interna de Auth.js: sin sesión,
  cualquier ruta redirige a `/login` con el `callbackUrl` original.
- Sesión JWT en cookie httpOnly firmada (`AUTH_SECRET`), expira a los 30 días (valor por
  defecto de Auth.js).
- Formulario de login mobile-first en `/login`.

Aún no hay funcionalidad de registro de peso/sesiones, historial, informe de progreso ni MCP
— llega en las siguientes fases del roadmap.
