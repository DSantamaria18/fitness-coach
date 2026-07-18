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

- **Fecha:** 2026-07-18
- **Decisión:** Historial de peso corporal y registro de sesión de entreno (fases 4 y 5 del
  roadmap) implementados en paralelo con dos agentes en ramas independientes
  (`feature/historial-peso`, `feature/registro-sesion`), cada uno en su propio `git worktree`
  bajo `.claude/worktrees/`, integrados después en una rama `integration/ronda-1` antes de
  fusionar a `master`.
- **Alternativas consideradas:** implementar ambas features en serie en una sola rama
  (descartado, regla 9 de CLAUDE.md pide paralelizar cuando las features son independientes,
  y estas no comparten código de dominio entre sí).
- **Justificación:** ambas features son independientes entre sí (una opera sobre `BodyWeight`,
  la otra sobre `Session`/`StrengthEntry`/`CardioEntry`) y ya existía el precedente de la fase
  3 de paralelizar UI/API con un contrato de dominio cerrado de antemano.
- **Lecciones aprendidas:**
  - La CI solo ejecutaba format/lint/typecheck/test, nunca `next build`. `/sesion` no forzaba
    renderizado dinámico (a diferencia de `/historial`, que lo consigue indirectamente al
    llamar a `auth()` dentro del Server Component) y Next intentaba prerenderizarla como
    página estática en build time, fallando al llamar a la base de datos — un fallo que habría
    llegado a `master` sin que nadie se enterase. Se añadió un paso de `build` a la CI
    (`.github/workflows/ci.yml`) con variables de entorno ficticias solo para que el proceso
    pueda arrancar. Regla general: cualquier página de Server Component bajo una ruta
    protegida por `proxy.ts` que haga I/O (BD, `auth()`, etc.) debe o bien llamar a una API
    dinámica de Next (como `auth()`), o bien declarar explícitamente
    `export const dynamic = "force-dynamic"` — no asumir que Next lo infiere siempre
    correctamente.
  - El reinicio del IDE a mitad de la ronda dejó un `git stash` (un fichero
    `.code-workspace` sin importancia) y varios `git worktree`/ramas a medio integrar, pero
    nada de código sin commitear: confirma que trabajar con commits atómicos por paso (regla
    11 de CLAUDE.md) permite recuperar el estado exacto tras una caída sin pérdida de trabajo.

---

- **Fecha:** 2026-07-18
- **Decisión:** Se sustituye el plan de backup diario automático (SPEC §11 original: `.backup`
  + subida a Backblaze B2/S3/GCS vía cron) por un backup **manual**: un botón en `/ajustes` que
  descarga al momento una copia consistente del SQLite (`db.backup()` de `better-sqlite3`), con
  un aviso en la propia UI si han pasado más de 30 días sin descargar uno o si nunca se ha hecho
  ninguno. No se sube a ningún almacenamiento externo — la descarga queda en el dispositivo de
  David (o donde él decida moverla, p.ej. Google Drive manualmente).
- **Alternativas consideradas:** cron dentro del propio contenedor (descartado: Fly.io free
  tier suspende la máquina sin tráfico — "auto stop" — y un cron interno no se dispararía si la
  máquina está dormida a esa hora); GitHub Actions programado llamando a un endpoint HTTP
  propio (descartado por ahora: añade un secret más que gestionar y una integración con Fly.io
  para automatizar un paso que, siendo un único usuario, es igual de fiable hecho a mano con un
  recordatorio); integración nativa con Google Drive vía OAuth (descartada: exige pantalla de
  consentimiento y gestión de tokens de refresco para automatizar un paso que ya es trivial
  reenviando manualmente el fichero descargado).
- **Justificación:** proyecto de un único usuario (David) sin obligación de continuidad ante
  terceros — el coste de que se le olvide hacer un backup ocasional es bajo, y el aviso a los
  30 días es red de seguridad suficiente sin la complejidad operativa de gestionar una cuenta
  cloud adicional (Backblaze/S3/GCS) solo para este propósito. Puede revisitarse si en el futuro
  se decide automatizarlo (ver BACKLOG.md).
- **Lecciones aprendidas:**
  - `@prisma/adapter-better-sqlite3` no expone la conexión nativa de `better-sqlite3`
    subyacente, así que generar un backup online requiere abrir una segunda conexión
    `better-sqlite3` de solo lectura directamente contra el fichero de `DATABASE_URL`, en
    paralelo a la que usa Prisma — no hay forma de reutilizar la conexión del ORM para esto.
  - Añadir un import directo de `better-sqlite3` en código propio (más allá de la dependencia
    transitiva que ya traía el adapter) exige declararlo como dependencia directa en
    `package.json` (y `@types/better-sqlite3` para el typecheck) — depender solo del hoisting
    de npm sin declararlo habría sido frágil ante cambios futuros del adapter.

---

- **Fecha:** 2026-07-18
- **Decisión:** Arranca la construcción del servidor MCP (SPEC §5) con alcance completo (las 7
  tools) en dos rondas: esta ronda (fase 1) cierra los huecos de dominio que faltaban —
  `get-session-history.ts` y `update-session.ts` (Developer A, rama `feature/historial-sesiones`)
  y `get-progress-report.ts` (Developer B, rama `feature/informe-progreso`) — antes de construir
  en una fase 2 la capa de transporte MCP en sí, que depende de ambas. Despliegue del servidor
  MCP: integrado en la app Next.js actual (Fly.io), protegido solo por token Bearer por ahora;
  la segunda capa de seguridad (VPN Tailscale) se añade cuando se migre al NAS propio de David
  (ver BACKLOG.md).
- **Alternativas consideradas:** acotar esta ronda a las 4 tools que ya tenían lógica de dominio
  (`log_weight`, `get_weight_history`, `log_session`, `list_exercises`) y posponer
  `edit_session`/`get_session_history`/`get_progress_report`; posponer el servidor MCP entero
  hasta tener el NAS+Tailscale montado. Ambas descartadas explícitamente por David a favor del
  alcance completo y del despliegue solo-token por ahora.
- **Justificación:** el SPEC ya aprobado especifica las 7 tools; construirlas todas de una vez
  evita una segunda ronda de "completar lo que falta" más adelante. El despliegue solo-token es
  una brecha de seguridad temporal asumida conscientemente (ver BACKLOG.md para el recordatorio
  de añadir Tailscale al migrar), no un descuido.
- **Decisiones de diseño de los Developers, revisadas y aprobadas por el Tech Lead sin bloquear
  la ronda** (no requerían decisión de producto, se documentan aquí por su impacto):
  - El filtro `ejercicio` de `get-session-history.ts` actúa a nivel de sesión completa: si una
    sesión contiene el ejercicio buscado, se devuelve la sesión entera (todos sus ejercicios),
    no solo las entradas que coinciden.
  - `get-progress-report.ts`: `currentStreakWeeks` se calcula siempre respecto a la semana ISO
    real (fecha del sistema), ignorando el filtro `hasta` — si `hasta` deja fuera la semana
    actual real, la racha sale 0 aunque haya una racha larga dentro del rango filtrado. Confirmado
    por QA con test explícito. Pendiente: cuando se construya la UI del informe de progreso, la
    racha debe explicarse bien para que no confunda a David (anotado en BACKLOG.md).
  - `sessionsPerWeek` promedia sobre el rango explícito `desde`/`hasta` si se indica, o si no
    sobre el span de las sesiones existentes (mínimo 1 semana).
  - Se extrajo `src/lib/session-entries.ts` (`resolveSessionEntries`) de `create-session.ts`
    para reutilizar en `update-session.ts` la validación de catálogo y construcción de datos
    anidados — duplicación real detectada por el propio Developer A antes de escribir el
    segundo caso, no después (a diferencia de la lección de la fase 3).
- **Lecciones aprendidas:**
  - Al lanzar un agente Developer con `isolation: "worktree"` además de indicarle por prompt un
    worktree ya preparado manualmente, el agente puede acabar trabajando en el worktree aislado
    que crea la propia herramienta (rama con nombre generado) en vez del indicado — pasó con el
    Developer del informe de progreso. Se detectó al revisar `git worktree list` tras recibir su
    resultado (la rama destino seguía en el commit base) y se corrigió moviendo los commits a la
    rama correcta (`git merge --ff-only`, ya que los commits partían del mismo punto). Para la
    próxima ronda con contratos de dominio ya cerrados: no combinar `isolation: "worktree"` con
    instrucciones explícitas de `cd` a un worktree ya preparado — o bien uno, o bien otro, no
    ambos a la vez.
  - Ambos Developers en paralelo esta vez NO duplicaron lógica entre sí (a diferencia de la fase
    3): sus dos piezas de dominio (sesiones vs. informe de progreso) no compartían ningún código,
    así que no hubo fricción de integración más allá de un merge limpio en
    `integration/ronda-2`.

---

_(se irá completando a medida que se tomen nuevas decisiones durante la implementación.)_
