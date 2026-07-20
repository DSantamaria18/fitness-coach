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

- **Fecha:** 2026-07-18
- **Decisión:** Fase 2 del servidor MCP (capa de transporte, sobre el dominio ya cerrado en la
  fase 1 de esta misma ronda): ruta única `POST /api/mcp` montada con el SDK oficial
  `@modelcontextprotocol/sdk` (v1.29.x), usando `WebStandardStreamableHTTPServerTransport`
  (subpath `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`) en **modo
  stateless** (`sessionIdGenerator: undefined`) + `enableJsonResponse: true`. Capa de dominio
  del servidor MCP en `src/lib/mcp/` (`auth.ts`, `resolve-user.ts`, `errors.ts`, `schemas.ts`,
  `tools.ts`), testeada por separado del transporte, que se mantiene lo más fino posible.
- **Alternativas consideradas:** `StreamableHTTPServerTransport` (la variante del mismo SDK
  pensada para `http.IncomingMessage`/`ServerResponse` de Node/Express clásico) envuelta en un
  puente manual hacia `Request`/`Response` de Next.js — descartada tras inspeccionar
  `node_modules/@modelcontextprotocol/sdk` y comprobar que la versión instalada ya trae
  `WebStandardStreamableHTTPServerTransport`, pensada explícitamente para runtimes con Web
  Standards (Next.js, Cloudflare Workers, Deno, Bun): no hacía falta escribir el puente que el
  encargo anticipaba como posiblemente necesario. Modo con sesión
  (`sessionIdGenerator: () => crypto.randomUUID()`) — descartado porque SPEC §5 y el encargo de
  esta ronda piden explícitamente stateless, ya que cada invocación de este Route Handler puede
  correr en una instancia serverless distinta sin estado compartido entre peticiones.
- **Justificación:** el transporte Web-standard del propio SDK es una integración directa (cero
  código de puente) con los Route Handlers de Next.js App Router, y el modo stateless es el
  único compatible con un despliegue serverless donde no se puede asumir que dos peticiones
  consecutivas las atienda el mismo proceso.
- **Lecciones aprendidas:**
  - Investigar el SDK ya instalado (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/*.d.ts`)
    antes de asumir que haría falta un adaptador manual: la versión 1.29 resuelve de fábrica el
    caso "Web Standard Request/Response", evitando escribir y mantener un puente propio hacia el
    protocolo JSON-RPC.
  - En modo stateless, `WebStandardStreamableHTTPServerTransport.validateSession()` se salta
    por completo (incluida la comprobación de "servidor no inicializado" que sí aplica en modo
    con sesión), así que un cliente puede enviar directamente `tools/call` sin haber mandado antes
    un `initialize` en esa misma petición — imprescindible para que esto funcione con una
    instancia nueva de `McpServer`/transporte en cada invocación serverless, ya que de lo
    contrario ningún `tools/call` llegaría nunca a completar el handshake previo que exige el
    modo con sesión.
  - `registerTool` de `McpServer` es un método genérico: extraer su firma con
    `Parameters<typeof server.registerTool>` fuera de una llamada real colapsa los tipos a
    `never` y rompe la inferencia de cada schema Zod concreto. Cada una de las 7 tools se
    registra con una llamada literal independiente en `route.ts` en vez de a través de una
    función auxiliar genérica.
  - Al mockear `@/lib/prisma` completo en un test (a diferencia de pasarle a una función un
    objeto ad-hoc que solo implementa su interfaz mínima, como ya hacía
    `verify-credentials.test.ts`), TypeScript infiere el tipo de retorno de `findUnique` a partir
    del cliente Prisma real completo (incluye todos los campos del modelo `User`, p. ej.
    `createdAt`), no de la interfaz mínima (`{id,username,passwordHash}`) que usan internamente
    `resolve-user.ts`/`verify-credentials.ts` — hay que rellenar el mock con el objeto completo
    del modelo aunque la función bajo test solo lea un subconjunto de sus campos.
  - Las tools MCP reutilizan literalmente los esquemas Zod ya exportados por la capa de dominio
    (`bodyWeightSchema`, `sessionSchema`), que usan los nombres de campo reales que persiste la
    base de datos (`weightKg`/`date` para peso; `fecha`/`ejercicios`/`peso_kg`/`tempo`/`RPE` para
    sesión, en español, igual que ya consume la skill "sesion-entrenamiento") — no los nombres
    ilustrativos en español de SPEC.md §5 (`log_weight(fecha, peso_kg)`), que ese mismo apartado
    ya marca como "provisionales, a refinar en el plan de implementación". Se deja constancia
    aquí para que no sorprenda al integrar la skill: el contrato real es el que exponen
    `schemas.ts`/`tools.ts`, no la firma ilustrativa del SPEC.

---

- **Fecha:** 2026-07-18
- **Decisión:** `delete-session.ts` borra una sesión con una única llamada
  `prisma.session.delete({ where: { id } })`, sin `deleteMany` explícito de
  `StrengthEntry`/`CardioEntry`/`StrengthSet` — se confía en el `onDelete: Cascade` ya declarado
  en `schema.prisma` para esas relaciones. Antes de asumirlo, se verificó empíricamente (no solo
  leyendo el esquema): un script puntual creó una sesión con una `StrengthEntry` + `StrengthSet`
  reales contra un fichero SQLite temporal, usando el mismo cliente/adapter que la app
  (`@prisma/adapter-better-sqlite3`), borró la sesión con `prisma.session.delete`, y confirmó
  que las filas hijas desaparecían (`strengthEntry.findMany`/`strengthSet.findMany` devolvían 0
  registros tras el borrado).
- **Alternativas consideradas:** replicar el patrón de `update-session.ts` (`deleteMany`
  explícito de `StrengthEntry`/`CardioEntry` dentro de una transacción antes de borrar la
  sesión) — descartada tras la comprobación empírica por ser código redundante que no aporta
  nada si la cascada ya lo hace, y porque además tendría que borrar `StrengthSet` a mano (no
  cubierto por ese patrón, que solo borra un nivel).
- **Justificación:** SQLite solo aplica claves foráneas (y por tanto `ON DELETE CASCADE`) si la
  conexión tiene `PRAGMA foreign_keys = ON`; que el `.sql` de la migración declare la cascada no
  garantiza por sí solo que se aplique en runtime con un driver/adapter concreto. Verificarlo con
  datos reales antes de escribir el borrado explícito evita tanto el riesgo de dejar registros
  huérfanos (si la cascada no funcionara y no se hubiera comprobado) como el de escribir código
  muerto/redundante (si funciona, como fue el caso).
- **Lecciones aprendidas:**
  - Cuando el esquema Prisma declara `onDelete: Cascade` sobre SQLite, no dar por hecho que se
    aplica solo por estar en `schema.prisma`/la migración: comprobarlo con una escritura real
    contra el adapter que usa la app en producción (aquí, un script desechable con
    `@prisma/adapter-better-sqlite3` contra un fichero temporal) antes de decidir si hace falta
    borrado en cascada manual. En este proyecto sí se aplica (confirmado), pero el mismo problema
    puede no ser cierto en otro adapter/versión, así que conviene repetir la comprobación si
    cambia alguno de los dos en el futuro, en vez de asumir que sigue siendo válida.

---

- **Fecha:** 2026-07-18
- **Decisión:** Se extrae `SessionEntriesEditor` (selección de ejercicio del catálogo, series
  dinámicas de fuerza, campos de cardio) de `session-form.tsx` a un componente compartido en una
  carpeta nueva, `src/components/` — hasta ahora el proyecto solo tenía componentes colocados
  dentro de su propia ruta en `src/app/<ruta>/`, sin ningún caso de componente usado por más de
  una ruta. El componente recibe `registros`/`onRegistrosChange` como prop controlado por el
  padre (`SessionForm` en `/sesion`, el formulario de edición nuevo en `/historial`), en vez de
  gestionar ese estado internamente, porque ambos padres necesitan conocer el número de
  ejercicios añadidos para su propio botón de guardar (`disabled={... || registros.length ===
  0}`, comportamiento ya existente en `/sesion` que había que preservar sin tests que lo
  cubrieran explícitamente).
- **Alternativas consideradas:** mantener el estado (`registros`) interno al componente
  compartido y exponer el conteo vía un callback `onEntriesChange` disparado desde un
  `useEffect` — descartada porque introduce una vuelta de renderizado adicional (el padre se
  entera del cambio un ciclo después) para resolver algo que un prop controlado resuelve de
  forma síncrona y más idiomática en React. Colocar el componente dentro de `src/app/sesion/` y
  que `/historial` lo importe desde ahí ("cross-import" entre rutas) — descartada por violar la
  convención ya establecida de que lo que vive dentro de `src/app/<ruta>/` es propio de esa
  ruta; una carpeta `src/components/` explícita dice más claramente "esto es compartido" que un
  import que cruza de una ruta a otra.
- **Justificación:** un prop controlado evita re-renders adicionales y mantiene el conteo de
  ejercicios siempre sincrónico con la interacción del usuario (relevante para no dejar enviar
  un formulario vacío ni un instante). Separar `src/components/` de `src/app/` dentro dice
  explícitamente qué código es infraestructura de UI compartida entre rutas, distinto de lo que
  es propio de una sola ruta — sienta el patrón a seguir si aparecen más componentes
  compartidos en fases futuras (wearables, fotos/medidas/comidas).
- **Lecciones aprendidas:** al refactorizar un componente ya cubierto por tests de
  comportamiento (`session-form.test.tsx`), verificar que la refactorización no obliga a tocar
  ni un solo test existente antes de darla por terminada (aquí, los 7 tests de
  `session-form.test.tsx` pasaron sin cambios) — es la señal de que el comportamiento externo
  no varió, solo la estructura interna (CLAUDE.md regla 5).

---

- **Fecha:** 2026-07-18
- **Decisión:** El Tech Lead corrigió (`npm install` en el repo raíz) un `node_modules`
  compartido por symlink entre worktrees que no tenía instalado `@modelcontextprotocol/sdk`
  pese a estar en `package.json` desde la fase del servidor MCP — rompía `next build` y un
  archivo de test en cualquier worktree que arrancara después de ese punto. El Developer de esta
  ronda lo detectó pero no lo tocó (correctamente: tocar `node_modules` compartido desde una
  rama de feature concreta puede pisar a otros agentes trabajando en paralelo en otro worktree).
- **Lecciones aprendidas:** el patrón de `node_modules` compartido por symlink entre worktrees
  (ver DECISIONS.md, ronda del servidor MCP) ahorra tiempo de instalación pero puede quedar
  desincronizado con `package.json` si una dependencia se añadió en una rama que aún no se había
  fusionado cuando se creó el symlink, o si algo limpió el `node_modules` raíz entre medias. Es
  responsabilidad del Tech Lead, no de los Developers, decidir cuándo reinstalar — evita que dos
  agentes reinstalen a la vez o que un Developer "arregle" el entorno compartido desde su propia
  rama sin visibilidad de qué más depende de ese estado.

---

---

- **Fecha:** 2026-07-18
- **Decisión:** UI del informe de progreso (`/informe`, sobre el dominio ya cerrado de
  `get-progress-report.ts`) implementada con `recharts` (ya elegido por el Tech Lead) montado en
  un componente de cliente (`progress-charts.tsx`, `"use client"`) al que el Server Component
  (`page.tsx`) le pasa los datos ya serializados (fechas como string ISO, nunca `Date` — mismo
  criterio que el resto de la frontera server/client de la app). Cada métrica se dibuja en su
  **propio gráfico de una sola serie con su propio eje** (peso corporal; peso máximo y volumen
  total por separado para fuerza; distancia, duración y ritmo medio por separado para cardio) en
  vez de combinar métricas de escala muy distinta en un único gráfico multi-línea (p.ej. peso
  máximo ~50-150 kg frente a volumen total ~cientos/miles de kg aplastarían la serie más pequeña
  en el mismo eje Y). Los campos opcionales de cardio (`distanceKm`/`durationSeconds`/
  `avgPaceSecPerKm`, `number | null`) se pasan a recharts como `null` tal cual, con
  `connectNulls={false}` explícito en `<Line>`, para que una sesión sin ese dato aparezca como un
  hueco en la línea — nunca como un cero, que falsearía la evolución. Colores tomados del
  catálogo categórico validado de la skill `dataviz` (azul/verde/naranja, evitando los tonos
  claros de bajo contraste del catálogo).
- **Alternativas consideradas:** un único gráfico de fuerza con dos líneas (peso máximo +
  volumen total) tal y como sugería la redacción inicial del encargo — descartado al implementar
  por violar la regla de "un solo eje" de la skill `dataviz` (dos magnitudes de escala muy
  distinta combinadas en un mismo eje Y comprimen visualmente la serie menor); se documenta aquí
  como desviación respecto al encargo literal para que el Tech Lead la revise en el code review.
  Quitar los puntos `null` de cardio del array de datos en vez de dejarlos con valor `null` —
  descartado porque desplazaría las fechas restantes entre sí, dando la falsa impresión de
  sesiones consecutivas cuando en realidad hay una sesión de por medio sin ese dato medido.
- **Justificación:** prioriza que el gráfico sea legible y no engañoso por encima de ceñirse a la
  redacción literal del encargo, con la desviación documentada explícitamente para que quien
  revisa la PR pueda vetarla si prefiere el diseño original.
- **Lecciones aprendidas:**
  - `ResponsiveContainer` de recharts mide su contenedor con `ResizeObserver` antes de decidir si
    hay tamaño válido para renderizar el SVG interno; jsdom no implementa `ResizeObserver` ni
    layout real (`getBoundingClientRect` siempre devuelve `0`), así que sin polyfill los tests de
    componentes con recharts no renderizarían ningún SVG aunque el componente fuera correcto (el
    `ResponsiveContainer` simplemente no pinta nada y no lanza ningún error, así que el fallo es
    silencioso). Se añadió un polyfill mínimo (`ResizeObserver` no-op + `getBoundingClientRect`
    con tamaño fijo) a `vitest.setup.ts`, global para todos los tests, porque `recharts` calcula
    el tamaño síncronamente al crear el `ResizeObserver` (llama a `getBoundingClientRect` una vez
    nada más construirlo, sin esperar a que dispare ningún evento), así que basta con que ambos
    existan para que el gráfico completo se renderice de verdad en los tests.

---

- **Fecha:** 2026-07-19
- **Decisión:** Ampliación de SPEC.md (nueva §14 "Generación asistida por IA" + tocas en §1,
  §3, §4, §6, §7, §13): la app incorpora dos generaciones asistidas por IA antes del despliegue
  en Fly.io (David eligió "esto ahora, Fly.io después"). (1) *Propuesta de sesión* en `/sesion`:
  Claude Agent SDK cargando la skill "sesion-entrenamiento" (copiada en
  `skills/sesion-entrenamiento/SKILL.md`) con el servidor MCP propio de la app como fuente de
  tools en proceso; salida editable, nunca se guarda sin pasar por `validate-session.ts`. (2)
  *Comentario de progreso* en `/informe`, bajo demanda (botón, nunca automático): llamada
  directa a la API de Mensajes de Claude con el `get_progress_report` ya calculado como
  contexto; nuevo modelo `ComentarioProgreso` (una fila por usuario, se sobrescribe, sin
  histórico). Autenticación: `ANTHROPIC_API_KEY` de pago por token (Fly.io secrets).
- **Alternativas consideradas:** reimplementar la lógica de la skill directamente en el backend
  (descartado: duplicaría y desincronizaría con la skill que David sigue usando fuera de la
  app); guardar el comentario de progreso automáticamente en cada sesión, como campo de
  `Session` (descartado tras aclarar David que quiere generarlo bajo demanda, no en cada
  guardado — un campo en `Session` habría implicado o regenerarlo en cada sesión sin pedirlo, o
  dejarlo `null` la mayoría de las veces; un modelo aparte y sobrescribible encaja mejor);
  histórico de comentarios de progreso en vez de sobrescritura (descartado, David solo quiere
  el más reciente); autenticación por suscripción/OAuth del plan Pro/Max de David en vez de
  `ANTHROPIC_API_KEY` (investigado a fondo y descartado: los términos de consumidor de
  Anthropic restringen esos tokens a Claude Code/claude.ai, no están pensados para un servidor
  desatendido; el coste real con clave de API es marginal, ~1-6€/mes con uso diario, así que no
  compensaba el riesgo de incumplimiento de ToS).
- **Justificación:** reutilizar la skill ya validada por David en vez de reimplementar su
  lógica evita divergencia entre "lo que hace la app" y "lo que hace la skill en otros chats de
  Claude". Separar las dos integraciones por complejidad (Agent SDK+skill+tools vs. llamada
  simple a Mensajes) sigue el principio de no sobre-diseñar la pieza más simple (regla 4 de
  CLAUDE.md, SOLID). Tratar la salida de la IA como entrada no confiable (misma validación que
  el registro manual) evita que un fallo o alucinación del modelo corrompa el historial, que es
  la fuente de verdad.
- **Lecciones aprendidas:**
  - La secuencia de preguntas de producto sobre esta feature cambió de forma no trivial a
    mitad de negociación (el comentario de progreso pasó de "automático, guardado en cada
    sesión" a "bajo demanda, sobrescribible"): confirma el valor de la regla 2 de CLAUDE.md de
    no escribir SPEC.md hasta cerrar el diseño en conversación — de haber escrito el modelo de
    datos (`Session.aiComment`) en la primera pasada, habría hecho falta una migración
    destructiva de esquema para corregirlo.

---

- **Fecha:** 2026-07-19
- **Decisión:** Corrección de SPEC.md §14: la "propuesta de sesión" usa `@anthropic-ai/sdk`
  (cliente estándar de la API de Mensajes) con `client.beta.messages.toolRunner()`, no el
  paquete `@anthropic-ai/claude-agent-sdk`. La skill se inyecta como texto plano en el `system`
  prompt (leyendo `skills/sesion-entrenamiento/SKILL.md` en el propio proceso), no vía la
  convención de filesystem `.claude/skills/` que exige el Agent SDK.
- **Alternativas consideradas:** `@anthropic-ai/claude-agent-sdk` (la opción original de
  SPEC.md) — descartada tras investigar su documentación: es el motor de Claude Code, lanza un
  subproceso (`claude` CLI) por invocación con un binario nativo empaquetado, y su modelo de
  despliegue documentado son contenedores efímeros con `SessionStore` para persistir estado —
  pensado para agentes de código autónomos, no para una llamada puntual de "generar un JSON con
  un par de tools de solo lectura" desde un Route Handler. Habría añadido el binario nativo a la
  imagen Docker y arranque de subproceso por request sin aportar nada que esta tarea necesite.
- **Justificación:** `toolRunner()` da el mismo patrón funcional (bucle de tool-use
  multi-turno automático sobre tools propios) sin subproceso ni convención de filesystem —
  es solo un cliente HTTP, coherente con el resto del despliegue (mismo Dockerfile, sin
  dependencias nativas nuevas) y con el "comentario de progreso", que ya usaba la misma familia
  de SDK sin tools.
- **Lecciones aprendidas:** el nombre "Claude Agent SDK" es ambiguo en la documentación pública
  de Anthropic — no se corresponde con "SDK ligero para dar tools a Claude", sino específicamente
  con el motor de Claude Code. Antes de fijar en SPEC.md el nombre de una librería concreta para
  una integración de IA, conviene verificar con la documentación oficial (o un agente de
  investigación) qué es exactamente el paquete, no solo si "encaja conceptualmente" con lo que se
  necesita — evitó aquí comprometerse a un plan de implementación con una dependencia de
  despliegue pesada e innecesaria.

---

- **Fecha:** 2026-07-19
- **Decisión:** Sube `DEFAULT_TIMEOUT_MS` de la propuesta de sesión con IA
  (`generate-session-proposal.ts`) de 30s a **60s**.
- **Alternativas consideradas:** subir el timeout a un valor intermedio (p. ej. 40-45s) —
  descartado por seguir demasiado cerca de las duraciones reales observadas; reducir
  `MAX_EXPLORATION_ITERATIONS` para acotar la duración en vez de tocar el timeout —
  descartado porque limitaría la calidad de la exploración del modelo sin atacar la causa
  real (el límite de tiempo, no el número de turnos).
- **Justificación:** verificación manual en producción-local con una `ANTHROPIC_API_KEY` real
  (David, 5 pruebas) mostró que el flujo completo (fase de exploración con `toolRunner` +
  turno final con `tool_choice` forzado, ambas con Sonnet 5) tarda entre ~14s y ~31s según
  cuántas rondas de exploración necesite el modelo. Con el límite anterior de 30s, 3 de 5
  pruebas (60%) fallaron por timeout, con duraciones de ~31.0-31.14s — un segundo por encima
  del límite, no un caso raro sino el comportamiento típico. David decidió el nuevo valor
  (60s) como margen suficiente sobre la duración máxima observada.
- **Lecciones aprendidas:** un timeout fijado antes de tener datos de latencia real contra la
  API en vivo (esta constante se escribió en la ronda de generación asistida por IA, cuando
  todavía no había una `ANTHROPIC_API_KEY` real disponible para medir de verdad) es una
  estimación, no un valor de diseño fiable — conviene revisarlo en cuanto se dispone de
  mediciones reales, en vez de asumir que el número original ya contemplaba margen suficiente.

---

- **Fecha:** 2026-07-19
- **Decisión:** Mueve `buildInitialRegistros` (y los tipos `RegistroState`,
  `SessionEntryInitialData`, `CardioMetricKey`, y el generador de claves `nextRegistroKey`)
  de `src/components/session-entries-editor.tsx` a un módulo nuevo sin directiva `"use client"`,
  `src/lib/session-proposal/build-initial-registros.ts`.
- **Contexto/bug:** QA encontró, verificando en navegador real, que "Generar propuesta con IA"
  (`/sesion`) crasheaba con un Runtime Error 500 siempre que la IA tenía éxito: "Attempted to
  call buildInitialRegistros() from the server but buildInitialRegistros is on the client".
  `src/app/sesion/actions.ts` (Server Action, `"use server"`) importaba y llamaba directamente
  a `buildInitialRegistros`, exportada por `session-entries-editor.tsx` (`"use client"`). El
  bundler de RSC sustituye las exportaciones de un módulo cliente por una referencia opaca al
  importarlas desde el servidor; invocarla como función lanza esa excepción de forma
  determinista, no intermitente — es una restricción arquitectónica de RSC, no un fallo de
  timing. El bug ya estaba en `master` desde la PR de "propuesta de sesión con IA" (antes del
  fix de timeout de más arriba), sin detectarse porque ningún test lo ejercitaba: `actions.ts`
  no tenía test propio (`generateSessionProposalAction` solo se probaba indirectamente vía
  `session-form.test.tsx`, que mockea `./actions` por completo).
- **Alternativas consideradas:** envolver la llamada en un `try/catch` dentro de la Server
  Action y hacer la conversión "a mano" solo para ese caso — descartada por reintroducir la
  duplicación que `buildInitialRegistros` existía precisamente para evitar (la usa también
  `/historial` para prefiltrar el formulario de edición). Mantener `buildInitialRegistros`
  dentro de `session-entries-editor.tsx` y hacer que `actions.ts` llame a un endpoint HTTP
  interno en su lugar — descartada por añadir un round-trip innecesario a una función pura.
- **Justificación:** `buildInitialRegistros` es lógica de conversión pura (sin JSX ni hooks:
  `ValidatedSession.ejercicios`/`SessionEntryInitialData` → `RegistroState[]`), así que no
  necesita vivir en un módulo cliente — moverla a `src/lib/` (junto al resto de la capa de
  dominio de `session-proposal/`) la hace importable tanto desde Server Actions/Server
  Components como desde Client Components, sin restricción de RSC en ningún sentido.
  `nextRegistroKey` se movió también porque `buildInitialRegistros` depende de ella para las
  claves de React; cada lado del límite servidor/cliente tiene su propia instancia del módulo
  (procesos/bundles distintos), así que el contador no se comparte entre servidor y cliente,
  solo dentro de cada uno — igual que antes.
- **Lecciones aprendidas:**
  - Ninguna prueba con Vitest (ni siquiera importando el módulo cliente real sin mocks) habría
    detectado este bug: la directiva `"use client"` solo la interpreta el bundler de Next.js
    (webpack/Turbopack) al construir el árbol de RSC; en un entorno Vitest/jsdom normal
    (`@vitejs/plugin-react`, sin el loader de Next) es una simple cadena de texto sin efecto,
    así que llamar a una función "de cliente" desde un módulo "de servidor" funciona sin más en
    los tests aunque falle siempre en `next dev`/`next start` reales — se verificó
    empíricamente reproduciendo el patrón mínimo (`"use client"` + `"use server"` + llamada
    directa) en un test Vitest aislado, que pasó sin errores. La única forma de detectar esta
    clase de bug fue la verificación manual en navegador real (regla de trabajo del equipo:
    verificación en navegador real para cambios de UI/flujo) — confirma que esa regla no es
    opcional para features que cruzan el límite servidor/cliente.
  - Cuando una Server Action necesita reutilizar lógica de conversión que también usa un
    Client Component, esa lógica debe vivir desde el principio en un módulo sin directiva
    (`src/lib/...`), nunca en el componente cliente aunque parezca conveniente reutilizar el
    export existente — la PR original de "propuesta de sesión con IA" ya reutilizaba
    conscientemente `buildInitialRegistros` para no duplicar código con `/historial`, pero no
    reparó en que el punto de reutilización nuevo (una Server Action) cruzaba el límite RSC.

---

- **Fecha:** 2026-07-19
- **Decisión:** Suite E2E con Playwright (`e2e/`, `playwright.config.ts`) cubriendo los flujos
  críticos de móvil (login, registrar peso, registrar sesión, y las dos generaciones asistidas
  por IA). Las dos llamadas de IA (`generateSessionProposal`, `generateProgressComment`) se
  mockean sustituyendo `api.anthropic.com` por un servidor HTTP local
  (`e2e/mock-anthropic-server.ts`, módulo `http` nativo, sin dependencia nueva) apuntado vía la
  variable de entorno `ANTHROPIC_BASE_URL`, que el SDK `@anthropic-ai/sdk` ya respeta de
  fábrica. Emulación móvil con el preset Android `devices["Pixel 7"]` (Chromium), no un preset
  "iPhone *" (WebKit). Detalle técnico completo en ARCHITECTURE.md, sección "Tests E2E
  (Playwright)".
- **Alternativas consideradas:**
  - `page.route()` de Playwright para interceptar las llamadas a Anthropic — descartada porque
    solo intercepta tráfico que sale del contexto del navegador; las llamadas de IA de esta app
    las hace el servidor de Next.js (Server Actions/funciones de servidor,
    `generate-session-proposal.ts`/`generate-progress-comment.ts`), nunca el navegador, así que
    `page.route()` nunca las vería.
  - `ANTHROPIC_API_KEY` real contra la API en vivo — descartada por el criterio ya fijado en
    BACKLOG.md al proponer esta suite: gastaría dinero real en cada ejecución de CI sin ganar
    cobertura relevante, dado que el bug que motivó esta suite (RSC de
    `buildInitialRegistros`, ver entrada de más abajo) depende solo de cruzar la frontera
    servidor/cliente en cualquier éxito, no de que la respuesta del modelo sea real.
  - `next build && next start` como servidor bajo test — descartado en favor de `next dev`:
    arranque más rápido en cada ejecución local/CI, y sigue siendo un runtime real de Next.js
    (a diferencia de Vitest/jsdom) para el propósito de esta suite.
  - Emulación `devices["iPhone 13"]` (el preset "obvio" para SPEC §2, "navegador del móvil") —
    descartada tras el primer intento de ejecución local: los presets "iPhone *" de Playwright
    fijan `defaultBrowserType: "webkit"`, y solo había Chromium instalado (instalado
    explícitamente para esta ronda) — habría exigido instalar y mantener también WebKit solo
    para esta suite. Se sustituyó por `devices["Pixel 7"]` (Android, Chromium), que cubre el
    mismo objetivo de "verificar el layout mobile-first" sin ese coste.
- **Justificación:** el criterio de mockeo ya estaba fijado en BACKLOG.md (entrada "Tests E2E
  con Playwright", añadida en la ronda anterior tras el bug de RSC): los flujos de IA deben
  interceptar/mockear la respuesta de Anthropic en vez de gastar dinero real en cada CI. Un
  servidor HTTP local vía `ANTHROPIC_BASE_URL` es el único punto de intercepción posible dado
  que las llamadas de IA son servidor-a-servidor, no navegador-a-servidor.
- **Lecciones aprendidas:**
  - **Race de hidratación de React en `next dev`/Playwright**: un `click()`/`selectOption()`
    inmediatamente después de `page.goto()` puede no hacer nada si el componente `"use client"`
    de destino todavía no ha terminado de hidratarse — las comprobaciones de "actionability" de
    Playwright (visible/habilitado/estable/recibe eventos) no esperan a que React haya
    adjuntado los manejadores `onClick`/`onChange`, solo a que el elemento del DOM esté listo.
    Se manifestó de dos formas distintas en la misma ronda: un test que pulsaba un botón
    (`"Generar propuesta con IA"`) sin que ocurriera nada visible (ni éxito ni el aviso de
    fallo, porque el handler no estaba adjunto todavía), y otro que seleccionaba un ejercicio de
    un `<select>` y pulsaba "Añadir" — el valor del `<select>` cambiaba en el DOM, pero el
    estado de React (`selectedExercise`) seguía en su valor inicial porque el `onChange` tampoco
    estaba adjunto, así que se añadía el ejercicio por defecto en vez del seleccionado. Se
    corrigió con un helper (`e2e/support/navigation.ts`, `gotoReady`) que espera a
    `networkidle` tras cada navegación antes de interactuar. Es seguro esperar a `networkidle`
    en esta app concreta porque el WebSocket de HMR de `next dev` no se queda abierto
    indefinidamente frente a un origen no permitido (ver punto siguiente) — en una app con
    conexiones persistentes legítimas (polling, WebSockets propios) `networkidle` no sería una
    señal fiable de "ya se puede interactuar".
  - **`allowedDevOrigins` de Next 16 bloqueaba el WebSocket de HMR contra `127.0.0.1`**: al
    navegar Playwright contra `http://127.0.0.1:3100` (no `localhost`), la consola del
    `webServer` mostraba un warning de "Blocked cross-origin request to Next.js dev resource"
    para `/_next/webpack-hmr`. Sin efecto funcional en la suite (Fast Refresh no hace falta en
    tests), pero se añadió `127.0.0.1` a `allowedDevOrigins` en `next.config.ts` para eliminar
    el ruido y, sobre todo, porque ese bloqueo es precisamente lo que hace que `networkidle` sí
    llegue a resolver (ver punto anterior) en vez de esperar indefinidamente a un WebSocket que
    de otro modo se quedaría abierto.
  - Este es el test (`e2e/sesion-ia.spec.ts`) que habría atrapado, sin gastar un céntimo real,
    el bug de RSC de `buildInitialRegistros` de la ronda anterior (ver entrada de más abajo):
    verificado ejecutando la suite completa en local contra un `.next`/base de datos
    completamente limpios (sin caché de builds anteriores), con los 6 tests en verde.

---

- **Fecha:** 2026-07-19
- **Decisión:** Corregido con `prettier --write` un desajuste de formato en 6 ficheros
  (`src/app/informe/progress-comment.{tsx,test.tsx}`, `src/components/nav-bar-gate.test.tsx`,
  `src/components/nav-bar.test.tsx`, `src/lib/progress-comment/generate-progress-comment.ts`,
  `src/lib/session-proposal/build-initial-registros.test.ts`) que llevaba rompiendo el job
  `test` de CI en `master` desde el commit `48b7f1c` (2026-07-18 20:15h) — es decir, durante 3
  merges completos (PR #14, #15, y el commit directo de numeración BL-NNN) sin que se detectara.
- **Alternativas consideradas:** ninguna — es una corrección mecánica de formato, sin lógica de
  negocio de por medio.
- **Justificación:** `npm run format:check` (Prettier) forma parte del job `test` de CI, pero el
  Tech Lead venía verificando solo `npm run lint`/`npm run typecheck`/`npm test` en local antes
  de mergear cada PR, sin comprobar el estado real de CI en GitHub tras el merge. Los ficheros
  llegaron sin formatear probablemente en la PR #9 (`feature/informe-progreso`) y en la ronda de
  generación asistida por IA, y nadie lo notó porque CI seguía en rojo silenciosamente.
- **Lecciones aprendidas:** el Tech Lead debe comprobar el estado real de CI (`gh pr checks` o
  `gh run list`) como parte del Definition of Done, no solo replicar los mismos comandos en
  local — local y CI pueden divergir (aquí, un `git status` limpio en local no revela ficheros
  ya mergeados que nunca pasaron `format:check`). Añadir esta verificación al checklist de
  merge para evitar que vuelva a pasar desapercibido.

---

- **Fecha:** 2026-07-19
- **Decisión:** A partir de ahora, cada entrada de BACKLOG.md lleva un código secuencial y
  permanente `BL-NNN` (p. ej. `BL-001`). El código no se reutiliza ni se renumera aunque la
  entrada cambie de sección, se mueva a CHANGELOG.md al implementarse, o se descarte. Se
  asignaron códigos `BL-001` a `BL-014` a las entradas ya existentes en el orden en que
  aparecían en el fichero.
- **Alternativas consideradas:** prefijos separados por tipo (`FEAT-NNN`/`BUG-NNN`), descartado
  por simplicidad — de momento BACKLOG.md no distingue tipo de forma consistente en todas las
  entradas.
- **Justificación:** permite referenciar una entrada concreta del backlog de forma inequívoca
  (en commits, PRs, DECISIONS.md, conversación) sin depender de su posición en el fichero, que
  cambia según se añaden/mueven entradas.

---

- **Fecha:** 2026-07-19
- **Decisión:** Implementa BL-001 con una regla ESLint custom local,
  `local/no-client-import-in-server-file` (`eslint-rules/no-client-import-in-server-file.mjs`,
  registrada inline en `eslint.config.mjs`, sin publicar ningún paquete npm). Se activa en
  cualquier fichero cuya primera sentencia sea la directiva `"use server"`; para cada
  `ImportDeclaration`, resuelve el import (rutas relativas y el alias `@/*` vía `tsconfig.json`,
  probando extensiones `.ts`/`.tsx`/`.js`/`.jsx` e `index.*` para directorios) a un fichero real
  en disco y comprueba si SU primera sentencia es la directiva `"use client"`; si lo es, reporta
  un error en el `ImportDeclaration`. Los imports que no resuelven a un fichero del proyecto
  (paquetes de `node_modules`, alias sin configurar) se ignoran sin más. Referencia cruzada: el
  bug real que motiva esto es la entrada de `buildInitialRegistros` de más arriba en este mismo
  fichero (misma fecha).
- **Alternativas descartadas** (investigadas antes de escribir código, no repetir la
  investigación):
  - `eslint-plugin-react-server-components` (candidato original en BACKLOG.md BL-001): su única
    regla relevante (`use-client`) solo detecta si un fichero *debería* llevar `"use client"`
    por su propio contenido (hooks, APIs de navegador, JSX con handlers) — no inspecciona lo
    que un fichero importa de OTRO fichero marcado `"use client"`, que es justo el caso del bug
    real. No sirve para este problema.
  - `@next/eslint-plugin-next` (ya en uso vía `eslint-config-next`): no tiene ninguna regla
    relacionada (solo existe `no-async-client-component`, sin relación con esto).
  - Convención de carpetas + `no-restricted-imports` por directorio: descartada porque en este
    proyecto ficheros `"use server"`/`"use client"` conviven deliberadamente en la misma
    carpeta por ruta de Next.js App Router (p. ej. `src/app/sesion/actions.ts` junto a
    componentes cliente en `src/components/`) — no hay separación de directorio que sirva de
    proxy fiable.
- **Justificación:** ninguna alternativa madura del ecosistema cubre "detectar si el import de
  un módulo servidor resuelve a un fichero cliente"; escribir la regla es sencillo (resolución
  de imports a disco + lectura de una directiva de cabecera) y no requiere publicar ni mantener
  un paquete separado, solo un fichero pequeño dentro del propio repo.
- **Verificación:** 5 casos con `RuleTester` de ESLint
  (`eslint-rules/no-client-import-in-server-file.test.ts`, TDD — escritos y en rojo antes de
  existir la regla): válido (import relativo a fichero sin directiva), válido (fichero `"use
  client"` importando de otro `"use client"`, confirma que la regla no aplica fuera de `"use
  server"`), válido (paquete externo de `node_modules`), inválido (import relativo a fichero
  `"use client"`, el caso exacto del bug real), inválido (mismo caso vía alias `@/*`). Además,
  verificado empíricamente reproduciendo el bug real: se reintrodujo temporalmente la directiva
  `"use client"` en `build-initial-registros.ts` (ya importado por `app/sesion/actions.ts` vía
  `@/lib/session-proposal/build-initial-registros`) y se confirmó que `npm run lint` lo
  detecta, reportando ambos specifiers importados; el cambio se revirtió antes de commitear, sin
  quedar en el diff final.
- **Lecciones aprendidas:**
  - `tsconfig.json` es JSONC (admite comentarios `//`, como el propio `tsconfig.json` de este
    proyecto tras esta misma PR, que añade uno al excluir los fixtures de esta regla de
    `tsc`) — la primera versión de la lectura del alias `@/*` usaba `JSON.parse` directo sobre
    el contenido del fichero y fallaba silenciosamente (el `catch` de la función devolvía
    `null`, así que el import simplemente no se resolvía) en cuanto el propio `tsconfig.json`
    tuvo un comentario. Se detectó solo gracias al paso de verificación empírica de este mismo
    encargo (la reproducción del bug real vía alias `@/*` no reportaba nada, pese a que los
    tests con `RuleTester` — que usan fixtures con un `tsconfig.json` sin comentarios — sí
    pasaban). Corregido añadiendo un stripper de comentarios JSONC antes del `JSON.parse`. Deja
    constancia de que los tests aislados con fixtures "limpios" pueden no capturar cómo se
    comporta una herramienta contra el fichero de configuración real del proyecto: la
    verificación empírica de la ronda (ya exigida por el encargo para confirmar el fix del bug
    original) también sirvió para atrapar un bug nuevo en la propia regla, no solo para
    confirmar el caso ya conocido.

---

- **Fecha:** 2026-07-20
- **Decisión:** Implementa BL-015 añadiendo un visitor `ImportExpression` a
  `local/no-client-import-in-server-file` (BL-001), reutilizando tal cual `resolveImportToFile`
  y `fileStartsWithClientDirective` ya existentes. Si el argumento del `import()` no es un
  `Literal` de cadena estático (variable, template literal con interpolación, etc.), la regla
  no reporta nada — mismo criterio que ya aplicaba a paquetes de `node_modules` o alias sin
  configurar: no es un error, la regla simplemente no tiene información suficiente para
  pronunciarse. Mensaje de error nuevo (`clientDynamicImportInServerFile`, distinto de
  `clientImportInServerFile`) para que el texto en el editor/CI deje claro que el import es
  dinámico, aunque la causa raíz sea la misma.
- **Alternativas consideradas:** reutilizar el mismo `messageId` para ambos casos (el texto ya
  era genérico) — descartado porque el encargo pedía usar criterio y separar los mensajes
  cuesta una línea de `meta.messages` sin complicar la regla, y ayuda a quien lee el error en CI
  a localizar mentalmente qué construcción (`import(...)` vs. `import ... from ...`) están
  viendo sin tener que abrir el fichero. Intentar evaluar parcialmente template literals sin
  interpolación (p. ej. `` import(`./client-module`) ``) como si fueran un string literal —
  descartado por sobre-ingeniería: no es un patrón presente ni previsto en el código real del
  proyecto, y el propio encargo pedía no complicar la regla más de lo necesario.
- **Justificación:** mantiene el principio ya sentado en BL-001 (ignorar lo que la regla no
  puede resolver de forma estática, en vez de intentar adivinar) y evita duplicar la lógica de
  resolución de imports/lectura de directivas entre los dos visitors.
- **Verificación:** 4 casos nuevos con `RuleTester`
  (`eslint-rules/no-client-import-in-server-file.test.ts`, TDD — escritos y en rojo antes de
  tocar la regla): válido (`import()` a fichero sin directiva), válido (`import(variable)`
  no-literal, confirma que no revienta ni reporta), inválido (`import()` relativo a fichero
  `"use client"`), inválido (mismo caso vía alias `@/*`). Verificado también empíricamente
  reproduciendo el bug real (misma pareja de ficheros que BL-001,
  `build-initial-registros.ts`/`app/sesion/actions.ts`, cambiando el import de
  `buildInitialRegistros` a `await import(...)`): `npx eslint` lo detecta con
  `clientDynamicImportInServerFile`; el cambio se revirtió antes de commitear, sin diff
  residual.

---

- **Fecha:** 2026-07-19
- **Decisión:** Filtro de rango de fechas en `/informe` (BL-005). Tres decisiones de diseño no
  triviales, dentro del alcance ya aprobado por David:
  1. Conversión de `<input type="date">` (`YYYY-MM-DD`) a los límites de día que espera
     `getProgressReport`: medianoche UTC fija para `desde` (`T00:00:00.000Z`) y último instante
     del día en UTC para `hasta` (`T23:59:59.999Z`) — no la zona horaria del proceso Node. Es el
     mismo criterio ya usado en todo el resto de la app para convertir un `<input type="date">`
     (`peso/actions.ts`, `sesion/actions.ts`, `historial/actions.ts`: siempre
     `T00:00:00.000Z`), documentado ahí como "medianoche UTC" en un comentario de
     `weight-history-section.tsx`. Se sigue ese precedente en vez de usar la hora local del
     servidor porque UTC fijo es reproducible independientemente de en qué zona horaria corra
     el proceso (local, CI, Fly.io) — la hora local del proceso Node depende de configuración de
     entorno, no del código, y habría dado resultados distintos entre entornos para el mismo
     input del usuario.
  2. Filtro inválido a nivel de dominio (`desde` posterior a `hasta`, único caso que sobrevive a
     la validación de formato con `z.iso.date()` en `parse-date-range.ts`): en vez de construir
     un mecanismo de fallback nuevo, se reutiliza el ya existente para un `ejercicio` que ya no
     existe en el catálogo (`informe/page.tsx`: si el resultado con filtros falla y había algún
     filtro activo, se reintenta `getProgressReport(userId, {})` sin ninguno). Evita mantener
     dos mecanismos de "ignorar filtro inválido sin romper la página" haciendo esencialmente lo
     mismo.
  3. `ExerciseSelector` (existente, de la fase anterior del informe de progreso) reconstruía la
     URL desde cero (`/informe?ejercicio=X`), lo que habría borrado el nuevo filtro de fechas al
     cambiar de ejercicio (y viceversa, si `DateRangeFilter` hiciera lo mismo). Se extrajo
     `buildFilterUrl` (`informe/build-filter-url.ts`, combina
     `useSearchParams()` actual con las claves a cambiar/borrar vía `URLSearchParams`) y se
     refactorizó `ExerciseSelector` para usarla, además del nuevo `DateRangeFilter`. Efecto
     colateral menor ya documentado en el propio test: al pasar de construir la query a mano
     (`encodeURIComponent`) a `URLSearchParams`, los espacios se codifican como `+` en vez de
     `%20` — ambas formas son válidas y equivalentes en una query string, no es un cambio de
     comportamiento observable para el usuario.
- **Alternativas consideradas:** dejar `ExerciseSelector` sin tocar y aceptar que ambos filtros
  se pisen entre sí (descartado: es una regresión de UX directamente causada por añadir el
  segundo filtro, no un problema preexistente que quede fuera de alcance); guardar el rango de
  fechas en estado de React en vez de en la URL (descartado: rompería el patrón ya establecido
  de "la URL es la fuente de verdad de los filtros", que permite compartir/recargar un enlace
  con el filtro aplicado, igual que ya ocurre con `ejercicio`).
- **Justificación:** ver punto a punto arriba; en conjunto, minimiza superficie nueva
  reutilizando patrones y mecanismos ya existentes y verificados en el proyecto (fallback,
  contrato de fecha ISO, filtros controlados por URL) en vez de introducir alternativas
  paralelas.
- **Lecciones aprendidas:** ninguna nueva; se siguió sin repetir la lección ya registrada arriba
  (2026-07-18) de dejar bien explicado en la UI el porqué de que la racha ignore `hasta`, ahora
  que el filtro que lo hace visible ya existe.

---

- **Fecha:** 2026-07-19
- **Decisión:** BL-004 — el orden intercalado entre ejercicios de fuerza y cardio (p. ej.
  cardio-fuerza-cardio) se resuelve añadiendo un campo `order Int @default(0)` a `CardioEntry`
  (mismo campo que ya tenía `StrengthEntry`), calculando `order` en ambos builders de
  `session-entries.ts` sobre el índice del array `ejercicios` **original** (antes de filtrar
  por tipo fuerza/cardio), añadiendo `orderBy: { order: "asc" }` a la consulta de
  `cardioEntries` en `get-session-history.ts`, y sustituyendo la concatenación en dos bloques
  (`[...strengthEntries, ...cardioEntries]`) de `historial/page.tsx` por una fusión que ordena
  ambos arrays juntos por `order`, extraída a `src/lib/to-session-history-entry.ts`.
- **Causa raíz:** tres bugs independientes que se enmascaraban entre sí, todos con el mismo
  síntoma (fuerza-primero-cardio-después en vez del orden real):
  1. `CardioEntry` no tenía campo `order`, así que no había forma de saber en qué posición
     relativa iba cada entrada de cardio respecto a las de fuerza.
  2. `buildStrengthEntries` calculaba `order` con `ejercicios.filter(isFuerza).map((entry,
     order) => ...)` — el índice `order` del `.map` es la posición dentro del subarray YA
     filtrado, no la posición real en la lista mixta original. Con cardio-fuerza-cardio, el
     único `StrengthEntry` recibía `order: 0` en vez de `order: 1` (su posición real).
  3. `get-session-history.ts` tenía `orderBy: { order: "asc" }` en `strengthEntries` pero no en
     `cardioEntries` — aunque el punto 1 se hubiera arreglado sin este `orderBy`, Prisma no
     garantiza ningún orden de fila implícito, así que el orden de lectura habría sido
     impredecible en vez de solo incorrecto.
- **Alternativas consideradas:**
  - Guardar los ejercicios de una sesión en una única tabla polimórfica (`SessionEntry` con
    columnas nulables para los campos específicos de cada tipo) en vez de dos tablas separadas
    — descartada por ser un cambio de esquema mucho más invasivo (afecta a todo el dominio de
    sesiones, no solo al bug) para resolver un problema que un campo `order` compartido ya
    resuelve sin tocar la forma de las dos tablas existentes.
  - Guardar el orden serializado como JSON en la propia `Session` (p. ej. `orderedEntryIds:
    string`) en vez de un campo `order` por fila — descartada por introducir una segunda fuente
    de verdad del orden (la lista de ids y las propias filas) que podría desincronizarse (p.
    ej. si se borra una entrada sin actualizar la lista), mientras que un campo `order` por fila
    es la única fuente de verdad y no puede quedar huérfano.
- **Justificación:** el fix se limita a lo mínimo necesario para resolver el bug (un campo
  nuevo con default no destructivo, más lógica de cálculo/lectura/fusión), sin tocar el
  contrato de `resolveSessionEntries` hacia sus llamantes (`create-session.ts`/
  `update-session.ts` no necesitaron cambios propios — heredan el fix al llamar a
  `resolveSessionEntries`, confirmado con un test de round-trip dedicado). Extraer
  `toSessionHistoryEntry` de `historial/page.tsx` a `src/lib/to-session-history-entry.ts` sigue
  el mismo criterio que `buildInitialRegistros` (ver entrada de más arriba, misma fecha):
  lógica de conversión pura no necesita vivir dentro de un Server Component, y moverla permite
  testearla de forma aislada sin mockear `auth()` ni el resto del árbol de `/historial`.
- **Verificación (TDD):** test unitario en `session-entries.test.ts` con una lista intercalada
  cardio-fuerza-cardio que comprueba `order: [0, 2]` en cardio y `order: [1]` en fuerza (falla
  con el código anterior: `order: [0, 1]` en cardio y `order: [0]` en fuerza); test unitario en
  `to-session-history-entry.test.ts` que comprueba que la fusión por `order` reconstruye el
  orden intercalado a partir de dos arrays ya ordenados por separado; y un test de
  round-trip (`session-order-round-trip.test.ts`) que ejercita el escenario real de principio a
  fin a través de las funciones de dominio reales — `createSession` → `updateSession` (editar
  sin cambiar nada, el camino exacto que dispara el bug en `/historial`) → `getSessionHistory` →
  `toSessionHistoryEntry` — contra un fake de Prisma en memoria (vía `vi.hoisted`, ya que el
  resto de la suite mockea Prisma por llamada y este escenario necesita encadenar tres
  operaciones que comparten el mismo estado subyacente). Confirmado que los tres tests fallan
  contra el código anterior antes del fix (revertido temporalmente con `git stash` para
  verificarlo) y pasan después.
- **Lecciones aprendidas:** un test de round-trip que ejercita las funciones de dominio reales
  en cadena (crear → editar sin cambios → releer) detectó un matiz que un test aislado de
  `resolveSessionEntries` por sí solo no habría cubierto: el escenario real del bug no es
  "registrar una sesión intercalada", es "editarla sin tocar nada" — el formulario de edición
  precarga los ejercicios ya guardados y los reenvía tal cual si el usuario no cambia nada, así
  que el bug solo se manifestaba en el segundo paso (`updateSession`), no en el primero
  (`createSession`). Vale la pena construir el fake de Prisma en memoria una vez que un bug
  cruza varias funciones de dominio encadenadas, en vez de intentar cubrir el mismo caso solo
  con mocks por-llamada de cada función por separado.

---

- **Fecha:** 2026-07-19
- **Decisión:** Comparar periodos en `/informe` (BL-006). Decisiones de producto ya cerradas
  por David: gráfico superpuesto (dos series en el mismo `LineChart`, no lado a lado ni tabla
  de deltas) y solo presets fijos ("Este mes vs. anterior" / "Este año vs. anterior", nada de
  rango libre a medida). Decisiones de diseño no triviales dentro de ese alcance:
  1. **Colisión de varios puntos el mismo día relativo**: si hay más de una sesión el mismo
     día dentro de un periodo, `alignComparisonSeries` se queda con el último valor en orden
     de entrada — literalmente, incluso si ese último valor fuera `null` y uno anterior el
     mismo día tuviera un dato real (caso límite improbable con un único usuario: dos sesiones
     de cardio el mismo día donde la segunda no midió un campo que la primera sí). No se
     intentó "rellenar con el valor no nulo más reciente" para no añadir una regla de
     precedencia adicional a un caso ya de por sí raro — si en la práctica llega a pasar y
     resulta confuso, se revisita.
  2. **Qué métrica comparar cuando hay varias visibles a la vez**: en vez de elegir una única
     "métrica principal" (ambiguo para cardio, que tiene tres: distancia/duración/ritmo), la
     comparación sustituye **cada** gráfico de métrica individual actualmente visible (peso
     corporal si no hay ejercicio filtrado, o las 2-3 métricas del ejercicio filtrado) por su
     propio `ComparisonChart`. Evita inventar un criterio de "métrica principal" que no pedía
     el encargo y que sería arbitrario para cardio.
  3. **Interacción con el rango de fechas manual (BL-005)**: mutuamente excluyentes. Activar la
     comparación borra `desde`/`hasta` de la URL (y viceversa), tanto a nivel de UI
     (`ComparisonPeriodSelector`/`DateRangeFilter`, vía `buildFilterUrl`) como de defensa
     server-side en `page.tsx` (si ambos llegasen a coexistir en una URL editada a mano,
     `comparar` gana y `desde`/`hasta` se ignoran). Alternativa descartada: dejar que
     `desde`/`hasta` acoten además el periodo "actual" de la comparación — descartada por
     ambigüedad de producto no resuelta (¿acotar solo el actual, o recalcular también el
     anterior con el mismo desplazamiento?) que no merecía la pena resolver sin que David lo
     pidiera explícitamente.
  4. **Ejercicio de la comparación**: usa el ejercicio ya **resuelto** por el informe general
     (`data.exercise?.exercise`, después de cualquier fallback por `ejercicio` inexistente en
     el catálogo), no el `ejercicio` crudo de la URL — así las dos llamadas adicionales a
     `getProgressReport` (periodo actual/anterior) nunca pueden fallar por `NOT_FOUND`, ese
     caso ya quedó resuelto antes de llegar a la lógica de comparación.
  5. **Color de la segunda serie del `ComparisonChart`**: se reutiliza el par azul/verde (slots
     1/2 del catálogo categórico, `references/palette.md` de la skill dataviz) que ya conviven
     adyacentes en `StrengthCharts` (peso máximo/volumen) — CVD-validado de antemano, no hace
     falta re-ejecutar el validador. Con dos series en el mismo `<svg>` necesitando color propio
     con soporte de modo oscuro, el truco `currentColor` + clase de color en el `<div>`
     contenedor que ya usaba `SingleMetricChart` no basta (solo sirve para un color por
     gráfico, y la leyenda de Recharts vive en un nodo del árbol distinto al de la línea, así
     que no comparte el mismo `currentColor` heredado). Se sustituye por una variable CSS
     (`--series-actual-color`, con su variante `dark:`) definida en el `<div>` contenedor: la
     heredan tanto la línea como el swatch de la leyenda. El verde no cambia entre modo
     claro/oscuro en la tabla de la skill, así que va como color literal sin necesidad de
     variable.
- **Alternativas consideradas:** ver cada punto arriba.
- **Justificación:** en conjunto, todas las decisiones evitan introducir criterios nuevos y
  ambiguos (métrica principal, precedencia de colisión, combinación de dos filtros de fecha a
  la vez) que el encargo no pedía resolver, y reutilizan mecanismos ya existentes y verificados
  del proyecto (fallback ante filtro inválido, paleta ya validada, patrón de filtro
  controlado-por-URL) — mismo criterio que ya se siguió en BL-005.
- **Verificación:** además de los tests unitarios (TDD, ciclo rojo→verde en cada pieza:
  `comparison-periods.test.ts`, `align-comparison-series.test.ts`,
  `comparison-period-selector.test.tsx`, casos nuevos en `date-range-filter.test.tsx` y
  `progress-charts.test.tsx`), se verificó en navegador real con Playwright MCP contra un
  usuario y datos de peso corporal sembrados a propósito (dos meses): los dos presets
  renderizan el gráfico comparativo con leyenda y colores correctos (confirma que la variable
  CSS del punto 5 funciona igual para la línea que para el swatch de la leyenda, algo que los
  tests con jsdom no pueden comprobar al no renderizar CSS real), y la exclusión mutua con el
  filtro de fechas manual se confirmó en ambas direcciones (activar la comparación borra
  `desde`/`hasta` ya presentes en la URL, y rellenar una fecha borra `comparar` ya activo).
  Cero errores de consola en ambos flujos.

---

- **Fecha:** 2026-07-20
- **Decisión:** Exportar `/informe` como imagen PNG (BL-007). Decisiones de producto ya
  cerradas por David: formato PNG (no PDF), alcance "toda la vista actual tal cual se ve en
  pantalla" (estadísticas + gráficos + controles de filtro, incluida la comparación de
  periodos si está activa). Decisión técnica del Tech Lead: librería
  [`modern-screenshot`](https://github.com/qq15725/modern-screenshot) (`domToPng`), un fork
  activo de `html-to-image` — elegida sobre `html2canvas`/`dom-to-image` por ser más ligera,
  sin dependencias de React, y por su enfoque basado en SVG nativo (`foreignObject`), que
  maneja mejor la variable CSS que ya usa `ComparisonChart` (`--series-actual-color`, BL-006)
  que un enfoque basado en reconstrucción manual de canvas como `html2canvas`.
  1. **Qué queda dentro/fuera del PNG**: el contenido se envuelve en
     `<div id="informe-content">` (estadísticas, filtros, gráficos), pero el `<h1>` y el propio
     botón "Descargar imagen" quedan **fuera** — no forman parte del "informe" en sí, y
     capturar el botón habría significado capturarlo a medio camino de cambiar a
     "Generando..." (el `setStatus("generating")` se dispara antes de `await domToPng(...)`).
  2. **Bug real encontrado en verificación manual (no en tests)**: la primera versión pasaba
     `domToPng(node)` sin más opciones. Comparando el PNG exportado contra una captura de la
     página en vivo con Playwright MCP (con el navegador en modo oscuro, tema real usado por
     David), el PNG salía con fondo **blanco** en vez de oscuro, y las etiquetas secundarias
     (`text-black/60 dark:text-white/60` — pensadas para fondo oscuro) casi invisibles: texto
     casi blanco sobre fondo casi blanco. Causa: `domToPng` solo captura el subárbol de
     `#informe-content`, no `<body>` (donde vive el `background: var(--background)` real de
     `globals.css`), y su `backgroundColor` por defecto es `null` (transparente, compuesto como
     blanco por la mayoría de visores) — mientras que los textos sí seguían resolviendo
     correctamente los colores del tema activo vía `getComputedStyle`. Corregido pasando
     `{ backgroundColor: getComputedStyle(document.body).backgroundColor }` explícitamente:
     toma el fondo real ya calculado por el navegador (claro u oscuro, lo que esté activo)
     en vez de asumir uno fijo.
  3. **Segundo bug real, encontrado por QA en la validación de la PR (no en la primera ronda de
     verificación manual)**: con un filtro de ejercicio o una comparación de periodos activos,
     los `<select>` de `ExerciseSelector`/`ComparisonPeriodSelector` mostraban en el PNG
     exportado su valor **por defecto** ("Todos" / "Sin comparar") aunque los gráficos de la
     misma imagen sí reflejaban correctamente el filtro/comparación activos — un PNG
     internamente contradictorio. Causa, confirmada leyendo el código fuente de
     `modern-screenshot` (no solo sus `.d.ts`): al clonar cada nodo, la librería ya intenta
     preservar el valor "vivo" de controles de formulario con una función interna
     (`It(e,t) { (esTextarea(e)||esInput(e)||esSelect(e)) && t.setAttribute("value", e.value) }`)
     — pero esto solo funciona de verdad para `<input>`/`<textarea>`, donde el atributo HTML
     `value` sí existe y sí determina qué se renderiza. Un `<select>` no tiene atributo `value`
     en HTML: lo que decide qué opción se ve marcada al rasterizar es el atributo `selected` de
     cada `<option>`, y el clon solo conserva el que ya estaba en el marcado original (la opción
     por defecto al cargar la página) — no refleja los cambios posteriores del usuario, porque
     `ExerciseSelector`/`ComparisonPeriodSelector` son controlados por la URL (`router.push` +
     re-render desde `page.tsx`), no por el atributo `selected` del HTML. Corregido con la
     opción `onCloneEachNode` de `domToPng`: por cada nodo clonado que sea un
     `HTMLSelectElement`, se lee el atributo `value` que la propia librería ya dejó (correcto,
     aunque inerte para `<select>`) y se traduce manualmente a la `<option>` que corresponde
     (`fixSelectedOption` en `export-image-button.tsx`) — sin necesidad de correlacionar el nodo
     clonado con el nodo real del DOM vivo, porque el dato correcto ya viaja en el propio clon.
- **Alternativas consideradas:** `html2canvas` y `dom-to-image` (descartadas por el Tech Lead
  antes de asignar la tarea, ver encargo original); PDF en vez de PNG (descartado por decisión
  de producto de David). Para el bug de los `<select>`: correlacionar el nodo clonado con el
  nodo real recorriendo ambos árboles en paralelo (por posición/`querySelectorAll`) —
  descartada por más frágil y compleja que aprovechar que la propia librería ya deja el valor
  correcto disponible en el atributo `value` del clon.
- **Justificación:** el mecanismo 100% client-side evita cualquier generación de imágenes en el
  servidor (sin coste de cómputo adicional, sin cruzar la frontera server/cliente que ya ha
  dado bugs reales en este proyecto — ver entrada 2026-07-19 sobre `buildInitialRegistros`).
  Excluir título y botón del PNG evita un caso de "capturarse a sí mismo a medio renderizar"
  que habría sido confuso. Los dos bugs de `modern-screenshot` encontrados en esta ronda
  (fondo/contraste y `<select>`) comparten la misma lección: ninguno de los dos se manifiesta
  en absoluto con `domToPng` mockeado (los tests con jsdom no interpretan CSS real ni tienen
  forma de saber qué "se ve" al rasterizar), así que solo la verificación manual en navegador
  real —y, en el caso del `<select>`, solo la de QA con un filtro/comparación realmente
  activos, no la primera ronda del propio Developer— pudo encontrarlos. Queda como
  precedente para cualquier futuro `<select>`/control de formulario nuevo que se añada dentro
  de `#informe-content`: revisar si necesita el mismo tratamiento en `onCloneEachNode`.
- **Verificación:** TDD completo (`export-image-button.test.tsx`, 7 tests: renderizado del
  botón, llamada a `domToPng` con el nodo y opciones esperadas, estado "Generando..." mientras
  la promesa está pendiente, aviso discreto en fallo de `domToPng` y en ausencia del
  contenedor, corrección del `<select>` clonado vía `onCloneEachNode` — extrayendo esa función
  del propio `mock.calls` de `domToPng` e invocándola contra un `<select>` construido a mano
  que reproduce el escenario del bug, ya que mockear la clonación real de la librería no es
  viable a nivel de test unitario — y que `onCloneEachNode` no toca nodos que no son
  `<select>`). Verificación manual con Playwright MCP en dos rondas: (1) login real,
  navegación a `/informe` con un registro de peso sembrado a propósito, clic real en
  "Descargar imagen" interceptando el evento `download` de Playwright
  (`page.waitForEvent('download')`) — confirma que el PNG descargado no es un mock (103 KB,
  nombre de fichero `informe-progreso-<fecha>.png` correcto) y, comparando visualmente el PNG
  contra una captura de la página en vivo, que el bug de fondo/contraste estaba presente antes
  del fix y desaparece después; (2) tras el fix del `<select>`, se repitió con
  `/informe?ejercicio=Sentadilla` y `/informe?comparar=mes` — el PNG exportado en ambos casos
  ya muestra la opción correcta marcada ("Sentadilla" / "Este mes vs. anterior") en vez de la
  opción por defecto.

---

- **Fecha:** 2026-07-20
- **Decisión:** Implementa BL-016 con una nueva función `findTransitiveClientFile` en
  `local/no-client-import-in-server-file` (BL-001, BL-015): tras resolver el import a un
  fichero real, si ese fichero no tiene ninguna directiva propia (ni `"use client"` ni `"use
  server"`), lee sus sentencias de re-export a nivel de módulo (`export * from "..."` /
  `export { a, b } from "..."`) con una **regex sobre el contenido completo del fichero**
  (`readModuleReexportTargets`, patrón `export\s*(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']`),
  resuelve cada destino con `resolveImportToFile` (reutilizada tal cual) y repite el proceso
  recursivamente, con un `Set` de rutas visitadas compartido en toda la travesía como
  protección contra ciclos: si una ruta ya visitada vuelve a aparecer, la recursión corta ahí
  sin reportar. La antigua `fileStartsWithClientDirective` se generalizó a
  `readLeadingDirective` (devuelve el literal de la directiva o `null`, no solo un booleano
  para `"use client"`), porque `findTransitiveClientFile` también necesita distinguir `"use
  server"` (fin de cadena explícito) de "sin directiva" (sigue reexportando) — comportamiento
  observable sin cambios para los tests ya existentes de BL-001/BL-015 (siguen en verde sin
  tocarlos), solo cambia la implementación interna, que es justo lo que permite la regla 5 de
  CLAUDE.md.
- **Alternativas consideradas:**
  - **Parser JS/TS completo (`espree`/`@typescript-eslint/parser`) para el fichero
    intermedio**, en vez de regex — descartado por sobre-ingeniería para el caso real: un
    barrel de este proyecto es, por convención, un fichero que solo contiene sentencias
    `export ... from "..."` a nivel superior (nunca dentro de una función o bloque), así que
    una regex global sobre el texto completo encuentra exactamente las mismas sentencias que
    encontraría un parser, sin añadir una dependencia de parseo nueva ni el coste de invocarla
    por cada fichero intermedio de la cadena. Si en el futuro apareciera un caso real con
    re-exports condicionales o anidados en bloques (no es un patrón de JS válido para `export`
    de todos modos — `export` solo es legal a nivel de módulo), este enfoque se quedaría corto,
    pero no es una restricción real del lenguaje que un barrel pueda violar.
  - **Reportar en el ciclo en cuanto se detecta, en vez de solo cortar en silencio** — evaluado
    y descartado: un ciclo de re-exports sin ningún `"use client"` en la cadena (el caso de
    test `cycle-a.ts`/`cycle-b.ts`) no es en sí mismo un bug de RSC — es simplemente un barrel
    mal formado (probablemente un `export *` circular que en un bundler real fallaría o
    resolvería a un módulo vacío), fuera del alcance de esta regla. Cortar sin reportar es
    coherente con el resto de casos "sin información suficiente" (paquete de `node_modules`,
    alias sin configurar, `import()` no-literal): la regla no inventa un diagnóstico nuevo para
    un problema distinto al que existe para detectar.
  - **Mensaje de error señalando el barrel intermedio (el `resolvedPath` directo) en vez del
    fichero `"use client"` real** — descartado: mostrar el barrel como "(fichero use client)"
    sería literalmente falso (el barrel no lleva esa directiva) y menos útil para depurar que
    señalar el fichero real que causa el crash en runtime.
- **Justificación:** cierra el hueco de cobertura que dejaba BL-001 (detectado por QA: la regla
  solo miraba la directiva del fichero resuelto directamente, no la de un barrel intermedio sin
  directiva propia) reutilizando al máximo la infraestructura ya existente
  (`resolveImportToFile`), sin necesitar un parser nuevo para un caso que un escaneo textual
  razonable ya cubre por completo.
- **Verificación:** 5 casos nuevos con `RuleTester`
  (`eslint-rules/no-client-import-in-server-file.test.ts`, TDD — escritos y en rojo antes de
  tocar la regla): válido (barrel que reexporta de un fichero sin directiva, cadena
  server-safe completa), válido (ciclo de barrels sin ningún `"use client"`, confirma que no
  cuelga ni crashea), inválido (barrel con `export *` hacia un fichero `"use client"`),
  inválido (mismo caso con re-export nombrado `export { x } from`, confirma que la regex cubre
  ambas sintaxis), inválido (cadena de DOS barrels, confirma que la recursión sigue más de un
  salto). Verificado también empíricamente: barrel real de un salto
  (`src/lib/session-proposal/index.ts`, desechable, `export * from
  "./build-initial-registros"`), reintroduciendo `"use client"` en `build-initial-registros.ts`
  y enrutando el import de `actions.ts` a través del barrel (`@/lib/session-proposal` en vez de
  `@/lib/session-proposal/build-initial-registros`) — `npx eslint` detecta el fichero `"use
  client"` real al final de la cadena; barrel borrado y ambos ficheros revertidos antes de
  commitear, sin diff residual.
- **Nota sobre el encargo:** el encargo original describía el caso de re-export nombrado
  (`export { algo } from "./fichero-cliente"`) como "válido" en su enumeración de tests, pero
  el propio texto lo describe reexportando de un fichero `"use client"` — mismo caso de bug que
  el de `export *`, solo con sintaxis distinta. Se interpretó como una errata (el resto de la
  frase — "decide si tu regex cubre ambas formas" — solo tiene sentido si ambas formas deben
  detectarse igual) y se implementó/testeó como **inválido** (debe reportar), igual que la
  variante `export *`.

---

- **Fecha:** 2026-07-20
- **Decisión:** El menú hamburguesa de `nav-bar.tsx` (BL-009) alterna las clases Tailwind
  `hidden`/`flex` (con `sm:flex` fijo en el contenedor para que en pantallas grandes se
  muestre siempre) para mostrar/ocultar los enlaces según `isMenuOpen`. **No** usa el atributo
  nativo `hidden` del elemento HTML, pese a ser en teoría la opción con mejor semántica de
  accesibilidad (saca de verdad el contenido del árbol de accesibilidad mientras está oculto).
- **Contexto/bug:** la primera implementación sí usaba el atributo nativo `hidden`, combinado
  con `sm:flex` para forzar su visibilidad en pantallas grandes — patrón que la documentación
  de Tailwind (v2/v3) describe como válido, y que en teoría debería funcionar porque una regla
  de origen "author" (`sm:flex`) debería ganar a una regla "user-agent" (`[hidden] {
  display:none }` del navegador) en el cascade, independientemente de capas/especificidad.
  Los tests con `RuleTester`/Vitest pasaban en verde, pero la verificación en navegador real
  (Playwright MCP, exigida por este mismo encargo) mostró la barra de navegación
  **completamente vacía en pantallas grandes** (ni enlaces ni botón de logout, ver captura
  `nav-desktop.png` de la ronda) — un bug que ningún test unitario podía detectar, porque
  jsdom no aplica hojas de estilo reales y por tanto no podía reproducir el problema.
  Inspeccionando el CSS generado (`grep '\[hidden\]' .next/.../globals.css`) se encontró la
  causa: el Preflight de **Tailwind v4** incluye
  `[hidden]:where(:not([hidden="until-found"])) { display: none !important; }` — con
  `!important`, que gana a cualquier utilidad de display sin importar origen/capa. Esto es un
  cambio de comportamiento de Tailwind v4 frente a v2/v3 (donde el patrón "atributo `hidden` +
  utilidad `md:block`" sí es el recomendado en su documentación), y explica por qué la barra
  quedaba vacía: el `!important` del Preflight neutralizaba `sm:flex` en cualquier breakpoint.
- **Alternativas consideradas:** mantener el atributo `hidden` y añadir `!important` también a
  la utilidad `sm:flex` (vía `important:` de Tailwind o CSS a medida) — descartado por
  complejidad innecesaria (CLAUDE.md regla 4) para un caso que el idioma estándar
  `hidden`/`flex` + `sm:flex` (sin atributo nativo, ya usado implícitamente en el resto del
  proyecto vía clases `hidden`/`sm:*`) resuelve de forma más simple y ya verificada.
- **Justificación:** el idioma basado puramente en clases (`hidden`/`flex` + `sm:flex`) no
  choca con el Preflight de Tailwind (que solo afecta al atributo nativo, no a la clase
  `.hidden`), y es el patrón que ya usa el resto del proyecto para responsive (`sm:flex-row`,
  `sm:grid-cols-3`, etc.), sin introducir una excepción de comportamiento respecto al resto de
  la base de código.
- **Verificación:** este bug NO lo detectaron los tests unitarios (`nav-bar.test.tsx` en
  verde con la versión rota, porque jsdom no simula CSS real) — solo lo encontró la
  verificación en navegador real que este mismo encargo exigía para cambios de UI/flujo. Tras
  el fix, reverificado en Playwright MCP: 375px (menú colapsado por defecto, abre/cierra,
  Escape, clic fuera, navegación cierran el menú) y 1024px (barra idéntica a la versión
  anterior a BL-009, sin hamburguesa, los 5 enlaces + logout visibles). Los tests unitarios se
  adaptaron para comprobar las clases `hidden`/`flex` del contenedor directamente (jsdom no
  aplica CSS, así que `toBeVisible()` no distingue nada aquí de todos modos).
- **Lecciones aprendidas:** cuando una feature depende de CSS real (visibilidad, layout,
  breakpoints), "tests unitarios en verde" no es señal suficiente de que funciona — ni siquiera
  cuando el patrón usado está documentado como correcto en general, porque el comportamiento
  exacto puede depender de la versión concreta de la herramienta (aquí, un cambio de Tailwind
  v3 a v4 invierte la recomendación sobre combinar el atributo `hidden` con utilidades de
  display). Esto refuerza la regla ya existente en CLAUDE.md sobre verificar en navegador real
  los cambios de UI/flujo: aquí no fue "deseable", fue la única forma de detectar el bug antes
  de que llegara a QA o a producción.

---

- **Fecha:** 2026-07-20
- **Decisión:** Implementa BL-010 como un indicador de sección plano (`SectionIndicator`,
  `src/components/section-indicator.tsx`) en vez de un breadcrumb jerárquico literal ("Inicio >
  Sección > Subsección"). Se renderiza una única vez en `src/app/layout.tsx`, justo debajo de
  `NavBarGate`, no repetido en cada `page.tsx`. Deriva el label comparando `usePathname()`
  contra `NAV_LINKS`, extraído de `nav-bar.tsx` a un módulo nuevo compartido
  (`src/lib/nav-links.ts`) para que ambos componentes lean de la misma fuente. Se autooculta
  (`null`) en rutas que no son ninguna de las 5 secciones (`/login`, `/`, que redirige antes de
  pintar nada).
- **Alternativas consideradas:**
  - **Breadcrumb jerárquico real** (la lectura literal del título de la entrada de BACKLOG.md,
    "Breadcrumbs...") — descartado: la app tiene un único nivel de navegación (5 secciones
    planas, sin sub-rutas anidadas tipo `/informe/detalle/x`), así que una cadena
    "Inicio > Sección" no aportaría ninguna información que la ruta activa ya resaltada en
    `nav-bar.tsx` (`aria-current="page"`) no diera ya — sería un componente nuevo que repite el
    mismo dato con más ceremonia visual, sin resolver el problema real que motiva la entrada
    (justificación de BACKLOG.md: "puede no ser obvio en qué sección está el usuario sin mirar
    arriba"). Se interpretó el encargo por su justificación, no por su título literal.
  - **Componente repetido en cada `page.tsx`** (opción (a) del encargo) — descartado frente a
    colocarlo una sola vez en `layout.tsx`: el proyecto ya tiene un único layout raíz compartido
    por todas las rutas (no hay grupos de rutas `(auth)`/`(public)` separados), así que
    repetirlo en los 5 `page.tsx` habría sido pura duplicación sin ningún beneficio — el mismo
    componente en `layout.tsx`, autoocultándose por pathname, cubre las 5 secciones actuales y
    cualquiera futura sin tocar más ficheros.
  - **Mostrar el indicador siempre, incluso fuera de las 5 secciones** (p. ej. algo genérico en
    `/login`) — descartado: `/login` y `/` (que solo redirige) no son "secciones" de la app en
    el sentido de `NAV_LINKS`, y forzar un valor no derivaría de la misma fuente de verdad que
    la nav — mejor no mostrar nada que mostrar algo inventado.
- **Justificación:** resuelve el problema real (reforzar visualmente en qué sección está el
  usuario, cerca del título, sin depender de mirar la barra fija arriba — relevante también en
  móvil, donde esa barra puede estar colapsada detrás del menú hamburguesa de BL-009) con el
  mecanismo más simple posible (CLAUDE.md regla 4): ni una jerarquía que la app no tiene, ni un
  componente duplicado en 5 ficheros cuando un layout compartido ya existe.
- **Verificación:** TDD con 7 casos (`section-indicator.test.tsx`): las 5 secciones muestran su
  label correcto, y dos rutas no-sección (`/login`, `/`) no muestran nada. Verificado también en
  navegador real con Playwright MCP: las 5 secciones (`/peso`, `/sesion`, `/historial`,
  `/informe`, `/ajustes`) muestran el label correcto junto al `<h1>`, en claro y oscuro, y en
  móvil con el menú hamburguesa (BL-009) tanto abierto como cerrado.

---

## 2026-07-20 — Pivote de despliegue: Fly.io + Docker → Vercel + Turso

- **Decisión:** se abandona el plan original de SPEC.md (Docker + Fly.io con volumen
  persistente para el fichero SQLite) en favor de **Vercel (plan Hobby) + Turso** (libSQL,
  compatible con SQLite, base de datos alojada).
- **Alternativas consideradas:**
  - **Fly.io tal cual estaba en SPEC.md** — descartada tras verificar contra la documentación
    oficial de precios (no solo asumir que "free tier" seguía vigente, lección ya aprendida en
    esta misma sección con "Claude Agent SDK"): Fly.io eliminó su free tier permanente en 2024;
    una VM mínima 24/7 con volumen cuesta ~$3-5/mes. David prefirió buscar una alternativa
    gratuita antes de aceptar ese coste.
  - **Oracle Cloud "Always Free"** — descartada: aunque es gratis de verdad (VM ARM sin límite
    de tiempo), es una VM cruda sin plataforma de despliegue, con la carga operativa de
    administrar el servidor a mano (SSH, actualizaciones) que Fly.io/Vercel evitan.
  - **Render (free tier)** — no elegida explícitamente, pero descartada implícitamente frente a
    Vercel: Render duerme el servicio tras 15 min de inactividad (cold start de ~1 min en la
    siguiente petición), mientras que Vercel no tiene ese problema y además es la propia
    empresa de Next.js (soporte de primera para App Router/Server Actions/Auth.js).
- **Justificación:** Vercel Hobby es gratuito para uso personal/no comercial (encaja con este
  proyecto de un único usuario), sin "sleep", con hasta 300s de duración de función (de sobra
  para los ~44-60s que tardan las llamadas de IA de `/sesion` y `/informe`), e integración
  nativa con GitHub para despliegue automático en cada merge a `master` (decisión explícita de
  David: sin paso manual intermedio, a diferencia de la recomendación inicial del Tech Lead de
  requerir aprobación manual). Turso da el free tier necesario para no depender de un volumen
  persistente (que Vercel, al ser serverless, no ofrece de todas formas).
- **Impacto en documentación viva:** SPEC.md §8-11 reescritas (persistencia, observabilidad,
  despliegue, backup); ARCHITECTURE.md pendiente de actualizar sus referencias sueltas a
  Fly.io como parte de la implementación.
- **Migraciones — problema real, no solo teórico:** confirmado contra la documentación oficial
  de Prisma y Turso que **ni `migrate dev`, ni `db push`, ni `migrate deploy`** funcionan
  directamente contra una base de datos Turso remota (libSQL habla HTTP, incompatible con
  Prisma Migrate). Se decidió, a propuesta de David, no limitarse al flujo mínimo documentado
  por Turso (generar en local + `turso db shell` a mano) sino añadir una verificación real en
  CI: Turso publica una imagen Docker oficial de su propio servidor (`libsql-server`,
  `ghcr.io/tursodatabase/libsql-server`) que habla el mismo protocolo HTTP que Turso en la
  nube — se levanta vía testcontainers en CI, se le aplica el SQL de la migración recién
  generada, y solo si eso pasa se aplica el mismo SQL a la Turso de producción. Esto es más
  riguroso que lo que había hoy con SQLite puro (donde no existía ninguna verificación
  separada antes de aplicar una migración).
  - **Alternativa descartada:** una segunda base de datos Turso remota dedicada a tests/CI (en
    vez de un servidor local vía testcontainers) — descartada porque Turso no tiene "esquemas"
    al estilo Postgres (cada base es su propia instancia), y un segundo Turso real solo
    trasladaría el mismo problema de migraciones a una segunda instancia sin resolverlo, además
    de gastar cuota del free tier y añadir latencia de red a cada ejecución de CI.
  - **Pendiente de resolver en el plan de implementación:** cómo se lleva el control de qué
    migraciones ya se aplicaron a Turso, dado que `_prisma_migrations` asume que el propio CLI
    de Prisma hizo el trabajo y aquí se aplica el SQL a mano.
- **Impacto en features ya mergeadas:** el backup manual de `/ajustes` (mergeado el
  2026-07-18) queda roto por este cambio — su implementación actual
  (`src/lib/create-backup.ts`) abre el fichero SQLite local directamente con la API de backup
  online de `better-sqlite3`, algo que no existe en un despliegue serverless contra Turso. Se
  marca explícitamente como pendiente de rediseño en SPEC.md §11 en vez de asumir una solución
  sin haberla investigado — lección de esta misma sección (verificar contra documentación
  oficial antes de comprometer un mecanismo concreto) aplicada también aquí: no se ha
  investigado todavía si el mecanismo correcto es la API de plataforma de Turso, su CLI, o un
  volcado manual por tablas vía Prisma.
- **Bloqueantes externos:** el despliegue requiere que David cree las cuentas de Turso y
  Vercel (ninguna de las dos se puede crear en su nombre), y que genere el hash de la
  contraseña de admin de producción en local (`npm run hash-password`) — pendientes antes de
  poder despachar trabajo de implementación.

---

## 2026-07-20 — Infra fase 1: CI de migraciones Turso, healthcheck, guardrail de preview en Vercel

Trabajo del TechOps Engineer preparando el terreno del despliegue Vercel + Turso **sin
credenciales reales todavía** (fase 1). Los puntos que necesitan secretos o acceso al dashboard
de Vercel/Turso quedan documentados como checklist de fase 2 al final de esta entrada.

- **Job de CI `verify-turso-migrations` — testcontainers, no `services:`.**
  - **Decisión:** el contenedor `libsql-server` lo lanza el script de verificación de
    migraciones (que produce el Developer en `feature/despliegue-turso-adapter`) vía
    **testcontainers**, no un bloque `services:` del YAML de GitHub Actions.
  - **Alternativas consideradas:**
    - **`services:` en el YAML** — descartada: partiría la responsabilidad en dos (el YAML
      arranca el contenedor y el script asume que ya está levantado), duplicaría la config del
      contenedor, y no funcionaría igual en local (donde no hay `services:`). Ya SPEC.md §8 y la
      entrada de DECISIONS del pivote comprometían testcontainers precisamente para que la
      misma verificación corra idéntica en CI y en local, con el script controlando el ciclo de
      vida y la señal de readiness del contenedor.
    - **testcontainers (elegida):** una sola fuente de verdad del contenedor, dentro del script;
      los runners `ubuntu-latest` traen Docker preinstalado (lo único que testcontainers
      necesita), así que no hace falta `services:`. Contrapartida asumida: testcontainers hace
      pull de la imagen en tiempo de ejecución (primer run más lento) — aceptable.
  - **Verificado contra documentación oficial** (no asumido): la imagen es
    `ghcr.io/tursodatabase/libsql-server:latest`, escucha HTTP en `:8080` (y gRPC en `:5001`,
    no lo usamos), y requiere `SQLD_NODE=primary` para arrancar como instancia standalone
    (github.com/tursodatabase/libsql/blob/main/docs/DOCKER.md).
  - **Estado fase 1:** el job queda estructuralmente montado, es **independiente** (sin
    `needs:`) para no bloquear `test`/`e2e` ni depender de ellos, y **no requiere ningún
    secreto** (el servidor libSQL es local y efímero, no la Turso de producción). Incluye un
    *smoke* `continue-on-error: true` que arranca la imagen en el runner para de-riesgar la fase
    2 (probar que el runner puede levantarla), y un paso placeholder claramente marcado
    (`PENDIENTE FASE 2`) donde irá la invocación real al script. **No se ha inventado la
    interfaz del script** (nombre npm, args, ni cómo lleva el control de qué migraciones ya se
    aplicaron a Turso — cuestión abierta heredada del pivote): es un punto de integración
    explícito, a resolver en fase 2.

- **Healthcheck `GET /api/health` — ya existía; se documenta su intención, no se duplica.**
  - Ya había un endpoint (`src/app/api/health/route.ts`) que responde `200 { status: "ok" }`
    con su test de comportamiento. Se **reutiliza** en vez de crear otro. Se añadió solo un
    comentario de *por qué*: es un check de **liveness** (¿responde el proceso?), deliberadamente
    **sin round-trip a la base de datos**, para no gastar cuota de lectura de Turso ni provocar
    falsos negativos por latencia de red, y sin exponer versión/entorno ni dato sensible alguno.
    Sirve como URL de comprobación para Vercel/monitorización externa (SPEC.md §9).

- **Guardrail de preview deployments — el scoping de env vars NO es versionable; es dashboard.**
  - **Hallazgo (verificado en docs oficiales de Vercel):** el scope de una variable de entorno
    por entorno (Production / Preview / Development) se configura **solo en el dashboard o vía
    Vercel CLI**, no en `vercel.json` — `vercel.json` no tiene clave `env` en su esquema actual
    para valores ni para scoping. Por tanto, evitar que los preview deployments accedan a la
    Turso de producción **no se puede resolver en config-as-code**: se hace marcando las
    credenciales de producción como scope **Production únicamente** en el dashboard (ver
    checklist de fase 2).
  - **Lo que sí se versiona:** un `vercel.json` mínimo (`$schema` para autocompletado +
    `framework: "nextjs"` explícito). No se fija `maxDuration`: con *fluid compute* (activo por
    defecto) el plan Hobby ya da 300s por defecto y de máximo — de sobra para las llamadas de IA
    de ~44-60s (docs de Vercel, "Configuring Maximum Duration"), así que SPEC.md §10 ("hasta
    300s") es correcto para Hobby y no hace falta configurar nada extra.
  - **`VERCEL_ENV`** (`production` | `preview` | `development`) lo inyecta Vercel
    automáticamente en cada deployment: es la señal que permite al código, en fase 2, distinguir
    el entorno si hiciera falta un guardrail adicional en la app.

- **Punto de coordinación abierto para el Tech Lead (defensa en profundidad, fase 2):** si los
  preview deployments se quedan (a propósito) sin `TURSO_DATABASE_URL`, la app necesita decidir
  qué hace un preview sin BD de producción — fallar rápido con un mensaje claro, o conectar a un
  SQLite efímero de `/tmp`. Esto toca el adapter de Prisma (Developer de
  `feature/despliegue-turso-adapter`), no la infra: se deja como decisión explícita de fase 2,
  no se resuelve a ciegas aquí.

- **Alerta para David (vía Tech Lead), NO resuelta en esta ronda — modelo de red:** SPEC.md §2,
  §5 y §7 asumen que tanto la webapp como el servidor MCP están **expuestos únicamente a través
  de la VPN Tailscale, nunca abiertos a internet**. El pivote a Vercel (Hobby) sirve la app en
  **internet público** (Vercel no ofrece Tailscale); la protección pasa a ser login + token en
  vez de frontera de red. La entrada del pivote (2026-07-20) cubrió BD/despliegue/backup pero
  **no** esta implicación de seguridad. Es una decisión de producto/seguridad de David: no se ha
  tocado §2/§5/§7 en este trabajo, se traslada al Tech Lead para que la plantee.

### Checklist de pasos MANUALES pendientes en Vercel/Turso (fase 2 — los ejecuta el Tech Lead cuando tenga acceso)

Requieren credenciales reales o acceso al dashboard, imposibles en fase 1:

1. **Vercel — variables de entorno de PRODUCCIÓN (scope Production únicamente):**
   - `TURSO_DATABASE_URL` = URL de la Turso `fitness-coach` (formato `libsql://...`).
   - `TURSO_AUTH_TOKEN` = token de auth de esa Turso (generado con `turso db tokens create fitness-coach`).
   - `AUTH_SECRET` = el secreto de sesión de producción (`npx auth secret`).
   - `ADMIN_USERNAME` y `ADMIN_PASSWORD_HASH` (hash generado en local con `npm run hash-password`).
   - `ANTHROPIC_API_KEY` = clave de pago de Anthropic.
   - **Para cada una: en Project Settings → Environment Variables, marcar SOLO el checkbox
     "Production"** (desmarcar "Preview" y "Development"). Este es el guardrail que impide que un
     preview deployment escriba en la Turso de producción.
2. **Vercel — decidir qué reciben los preview deployments (si algo):** confirmar con el Developer
   del adapter la estrategia (fallar rápido sin BD, o SQLite efímero). Si se opta por una BD de
   preview distinta, añadir esas vars con scope "Preview". Por defecto (fase 1): los previews NO
   llevan credenciales de Turso.
3. **Turso — aplicar las migraciones a la base `fitness-coach`:** con el flujo del script del
   Developer (`feature/despliegue-turso-adapter`), aplicar el SQL generado en local vía
   `turso db shell fitness-coach < migracion.sql` (o el mecanismo que defina el script), tras
   verificarlo en CI contra `libsql-server`.
4. **CI — conectar la verificación real de migraciones (quita el `PENDIENTE FASE 2`):** en
   `.github/workflows/ci.yml`, sustituir el paso placeholder de `verify-turso-migrations` por la
   invocación real (`npm run <script-del-adapter>`) y quitar el `continue-on-error: true` del
   smoke para que pase a ser un gate real. Requiere que el script esté mergeado en `master`.
5. **Vercel — conectar el repo de GitHub** (integración Git) y confirmar que `master` es la
   Production Branch, para que cada merge despliegue a producción automáticamente (SPEC.md §10).
6. **Anthropic — configurar límite de gasto mensual** en console.anthropic.com como red de
   seguridad (SPEC.md §7/§14).

---

_(se irá completando a medida que se tomen nuevas decisiones durante la implementación.)_
