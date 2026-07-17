# Decisiones de diseño

Decisiones tomadas durante el desarrollo, con su justificación, y lecciones aprendidas de
errores pasados para no repetirlos. Revisar este archivo antes de arrancar cualquier tarea
nueva.

## Formato de cada entrada

- **Fecha:**
- **Decisión:**
- **Alternativas consideradas:**
- **Justificación:**
- **Lecciones aprendidas (si aplica):**

---

- **Fecha:** 2026-07-16
- **Decisión:** Stack Next.js + TypeScript + SQLite; conexión con Claude vía servidor MCP
  (accesible solo por VPN Tailscale + token secreto); login web con usuario/contraseña simple
  para el MVP; despliegue en Docker estándar, primero en Fly.io y con migración futura
  planificada al NAS propio de David; CI con GitHub Actions (tests + typecheck), sin entorno
  de staging; backup diario del fichero SQLite vía `.backup` a almacenamiento externo.
- **Alternativas consideradas:** PostgreSQL (descartado, sobredimensionado para un solo
  usuario), CSV (descartado, no modela bien relaciones uno-a-muchos como series por
  ejercicio), login con passkey/WebAuthn (pospuesto, no descartado), entorno de staging
  separado (descartado por ser overkill para un solo usuario), alertas activas de
  monitorización (pospuestas, solo logs por ahora).
- **Justificación:** proyecto personal de un único usuario, sin presupuesto adicional, con
  despliegue self-hosted futuro ya decidido. Se prioriza simplicidad operativa y portabilidad
  (Docker sin lock-in) sobre robustez que no aporta valor a un solo usuario.
- **Lecciones aprendidas:** ninguna todavía (primera decisión del proyecto).

---

- **Fecha:** 2026-07-16
- **Decisión:** No se migra el histórico JSON existente de la skill "sesion-entrenamiento" — la
  app arranca con la base de datos en limpio.
- **Alternativas consideradas:** importador/script de migración del JSON a SQLite en el MVP.
- **Justificación:** decisión explícita de David para mantener el MVP acotado; puede
  revisitarse más adelante si hace falta el histórico (ver BACKLOG.md).
- **Lecciones aprendidas:** —

---

---

- **Fecha:** 2026-07-17
- **Decisión:** Elecciones técnicas concretas para el andamiaje (fase 1 del roadmap de
  implementación): ORM Prisma (con el generador `prisma-client` + driver adapter
  `@prisma/adapter-better-sqlite3`, requerido por Prisma 7 al no traer motor Rust embebido por
  defecto), Vitest + Testing Library para tests (sin Playwright en el MVP), ESLint +
  Prettier, Tailwind CSS v4 para estilos mobile-first, y GitHub Actions ejecutando
  format/lint/typecheck/test en cada push. Estas decisiones concretan el stack ya aprobado en
  SPEC.md (Next.js + TypeScript + SQLite) sin cambiar lo pactado con David.
- **Alternativas consideradas:** Drizzle ORM (descartado frente a Prisma por su generador de
  migraciones más maduro y su integración más directa con TypeScript sin configuración
  adicional), Playwright para E2E (pospuesto a BACKLOG.md, no bloquea el MVP).
- **Justificación:** mantener el andamiaje simple y con herramientas de uso muy extendido,
  priorizando velocidad de desarrollo para un proyecto de un único desarrollador/usuario.
- **Lecciones aprendidas:**
  - `create-next-app` se niega a generar en un directorio que ya contiene ficheros (los `.md`
    de documentación viva). Hay que generar en un directorio temporal y copiar selectivamente
    los ficheros del scaffold, sin pisar la documentación ni el `CLAUDE.md` del proyecto.
  - `npm run format` (Prettier) reescribe agresivamente el `.md` de reglas de trabajo
    (`CLAUDE.md`), incluyendo las etiquetas tipo XML que usa para delimitar secciones,
    corrompiendo su indentación. Por eso `*.md` está excluido de Prettier vía
    `.prettierignore` — la documentación del proyecto se edita a mano, no se autoformatea.

---

_(se irá completando a medida que se tomen nuevas decisiones durante la implementación.)_
