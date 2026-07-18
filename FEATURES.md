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

Aún no hay ninguna funcionalidad visible para David (login, registro de peso/sesiones,
historial, informe de progreso, MCP) — llega en las siguientes fases del roadmap.
