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

- **Fecha:** 2026-07-17
- **Decisión:** Login (fase 2 del roadmap) con Auth.js (NextAuth) v5, provider Credentials +
  bcryptjs (no `bcrypt` nativo, para evitar compilación con node-gyp además de la ya existente
  de `better-sqlite3`). Config dividida en `auth.config.ts` (edge-safe: página de login +
  callback `authorized`, sin providers) y `auth.ts` (añade el provider Credentials, que usa
  bcrypt/Prisma y solo corre en runtime Node). `src/proxy.ts` crea su propia instancia de
  NextAuth a partir de `authConfig` para poder proteger rutas desde el runtime Edge sin
  arrastrar módulos nativos. Usuario único sembrado por `prisma/seed.ts` desde
  `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`, con `scripts/hash-password.ts` como utilidad para
  generar el hash sin escribir el password en claro en ningún fichero.
- **Alternativas consideradas:** `bcrypt` nativo (descartado, añadiría un segundo módulo con
  compilación nativa en Windows), guardar el password sembrado en claro en `.env` y hashearlo
  en el propio seed (descartado: el hash es el artefacto que debe vivir en el secreto de
  despliegue, no el password).
- **Justificación:** separar la config edge-safe de la que depende de Node es el patrón
  estándar de Auth.js v5 para que el middleware/proxy (que corre en Edge) no falle al empaquetar
  dependencias nativas; permite además testear el callback `authorized` sin arrancar Auth.js
  completo.
- **Lecciones aprendidas:**
  - Next.js 16 renombró la convención `middleware.ts` → `proxy.ts` (el build falla con un
    error explícito si sigues usando `middleware.ts`). Además, el export debe ser una función
    literal (`export default auth`) — un `export const { auth: proxy } = ...` con
    desestructuración no lo reconoce el analizador estático del build aunque en runtime sea
    una función válida.
  - Si `src/proxy.ts` importa `auth` desde `src/auth.ts` (el que incluye el provider
    Credentials), el build arrastra el cliente de Prisma y sus módulos nativos de Node al
    runtime Edge y falla. Hay que construir una instancia de NextAuth separada solo con
    `authConfig` para el proxy/middleware.

---

- **Fecha:** 2026-07-17
- **Decisión:** Registro de peso corporal (fase 3 del roadmap) implementado con una capa de
  dominio (`validate-body-weight.ts`, Zod) y una capa de persistencia compartida
  (`create-body-weight.ts`) que reutilizan tanto la ruta `POST /api/body-weight` como la Server
  Action del formulario `/peso` — evita duplicar la validación/escritura entre el futuro
  servidor MCP y la UI web. La ruta API y el formulario UI se implementaron con dos agentes en
  paralelo (regla 9 de CLAUDE.md), cada uno con el contrato exacto de la capa de dominio ya
  cerrada; tras integrarlos se extrajo `create-body-weight.ts` porque ambos habían duplicado
  la misma lógica de validación+Prisma de forma independiente.
- **Alternativas consideradas:** que la Server Action hiciera un `fetch` HTTP a su propia API
  en vez de compartir código directamente — descartado por depender de una URL base no
  trivial de resolver dentro de una Server Action, y por ser una vuelta innecesaria dado que
  ambas corren en el mismo proceso Node.
- **Justificación:** una sola fuente de verdad para las reglas de negocio (rango de peso, fecha
  no futura, `userId` siempre desde la sesión) que se pueda testear una vez y reutilizar en
  cualquier punto de entrada futuro (MCP incluido).
- **Lecciones aprendidas:**
  - `authConfig` (fase 2) no tenía callbacks `jwt`/`session`, así que `session.user` nunca
    incluía el `id` devuelto por `authorize()` — cualquier código que dependiera de
    `session.user.id` trataba silenciosamente al usuario como no autenticado (401 en vez de
    guardar el dato). No se detectó en la fase 2 porque sus tests solo cubrían el callback
    `authorized`, no la forma de la sesión resultante. Se detectó en la verificación manual de
    `/peso` de esta fase, no por los tests automáticos — refuerza que la verificación manual en
    navegador exigida por CLAUDE.md para cambios de UI/flujo no es opcional aunque los tests
    unitarios estén en verde.
  - Al lanzar dos agentes en paralelo con un contrato de dominio ya cerrado pero sin visibilidad
    mutua del trabajo del otro, ambos reimplementaron independientemente el mismo patrón
    auth+validar+persistir. No es un problema grave (la lógica era correcta en ambos), pero
    conviene, tras integrar el trabajo paralelo, revisar activamente si hay duplicación que
    extraer antes de dar la fase por cerrada.

---

_(se irá completando a medida que se tomen nuevas decisiones durante la implementación.)_
