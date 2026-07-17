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

_(se irá completando a medida que se tomen nuevas decisiones durante la implementación.)_
