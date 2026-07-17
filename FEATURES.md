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

## Registro de peso corporal

- Formulario mobile-first en `/peso` para registrar el peso corporal del día (o de una fecha
  pasada): campo peso en kg y fecha (por defecto hoy, no permite fechas futuras).
- Validación de dominio compartida (`src/lib/validate-body-weight.ts`, Zod): peso entre 20 y
  300 kg, fecha válida y no futura.
- Persistencia vía `src/lib/create-body-weight.ts`, reutilizada tanto por el endpoint
  `POST /api/body-weight` (pensado para el futuro servidor MCP) como por la Server Action del
  formulario `/peso` — una sola fuente de verdad para la validación y la escritura en base de
  datos, sin duplicar lógica entre ambos puntos de entrada.
- El `userId` de cada registro sale siempre de la sesión autenticada, nunca del cuerpo de la
  petición ni del formulario.

Aún no hay funcionalidad de registro de sesiones de entreno, historial, informe de progreso ni
MCP — llega en las siguientes fases del roadmap.
