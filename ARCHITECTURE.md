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
- **Testing**: Vitest (unit + integración) + Testing Library (componentes) + jsdom para
  lógica/componentes aislados; Playwright para E2E en un navegador real (ver sección "Tests
  E2E (Playwright)" más abajo) — cubren capas distintas, no se solapan.
- **Lint/formato**: ESLint (`eslint-config-next`) + Prettier. Los ficheros Markdown de
  documentación (`*.md`) están excluidos del autoformateo (`.prettierignore`) porque se editan
  a mano y Prettier reescribe su estructura de forma indeseada.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) — en cada push/PR, el job `test` instala
  dependencias, genera el cliente Prisma, y corre `format:check`, `lint`, `typecheck`, `test` y
  `build` (con variables de entorno ficticias, solo para que el build pueda arrancar); un job
  `e2e` en paralelo instala Chromium y corre `npm run test:e2e`.
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

## Historial y edición de sesión de entreno

- `src/lib/session-entries.ts` — helper extraído de `create-session.ts` (`resolveSessionEntries`):
  valida existencia del ejercicio en el catálogo y que su tipo coincida (contra la base de
  datos, no en Zod) y construye los datos de creación anidada de `StrengthEntry`/`CardioEntry`
  a partir de los ejercicios ya validados por Zod. Compartido entre `create-session.ts` y
  `update-session.ts` porque ambos necesitan exactamente la misma lógica de "ejercicios
  validados → entradas listas para Prisma".
- **Orden intercalado de fuerza/cardio (BL-004, ver DECISIONS.md 2026-07-19)**: una sesión de
  entreno puede intercalar ejercicios de fuerza y cardio (p. ej. cardio-fuerza-cardio), pero
  Prisma los guarda en dos tablas separadas (`StrengthEntry`/`CardioEntry`) sin ningún array
  único que preserve ese orden por sí solo. Se reconstruye con un campo `order Int` compartido
  por ambos modelos, resuelto en tres pasos:
  1. **Escritura** (`session-entries.ts`, `buildStrengthEntries`/`buildCardioEntries`): `order`
     se calcula sobre el índice del array `ejercicios` **original** recibido (antes de filtrar
     por tipo), no sobre el índice del subarray ya filtrado — así, en cardio-fuerza-cardio, el
     `CardioEntry` del ejercicio 3 conserva `order: 2` aunque sea el segundo cardio, no el
     segundo elemento de "todos los cardio".
  2. **Lectura** (`get-session-history.ts`): la consulta incluye `orderBy: { order: "asc" }`
     tanto en `strengthEntries` como en `cardioEntries` — Prisma no garantiza ningún orden de
     fila implícito sin `orderBy` explícito.
  3. **Fusión** (`to-session-history-entry.ts`, extraído de `historial/page.tsx` para poder
     testearlo sin depender de `auth()`/Next.js): `strengthEntries` y `cardioEntries` llegan
     cada una ordenada por su propio `order`, pero siguen siendo dos arrays separados —
     `toSessionHistoryEntry` los fusiona en un único array y los reordena globalmente por ese
     campo antes de devolver `ejercicios`, en vez de concatenarlos en dos bloques (fuerza
     primero, cardio después), que es precisamente lo que causaba el bug original.

  `update-session.ts` hereda el fix automáticamente porque reconstruye la sesión completa
  llamando a `resolveSessionEntries` (paso 1) — no tiene lógica de orden propia.
- `src/lib/get-session-history.ts` — consulta las sesiones de un usuario (más recientes
  primero) con sus `strengthEntries` (+ `sets`, ordenadas por `order`) y `cardioEntries`
  (ordenadas por `order`) incluidos, cada uno con su `exercise` para poder mostrar el nombre
  sin consultas adicionales. Acepta filtros opcionales `desde`/`hasta` (mismo patrón Zod que
  `get-body-weight-history.ts`) y `ejercicio` (nombre del catálogo): una sesión "contiene" el
  ejercicio si aparece en cualquiera de sus entradas de fuerza o de cardio (SPEC §4 caso de
  uso 4) — el filtro actúa a nivel de sesión completa, no recorta las entradas devueltas.
- `src/lib/update-session.ts` — edita una sesión existente: valida forma (Zod), comprueba con
  un `findFirst({ id, userId })` que la sesión pertenece al usuario antes de escribir (mismo
  patrón de guarda de autorización que `update-body-weight.ts`), resuelve los ejercicios contra
  el catálogo vía `resolveSessionEntries`, y sustituye por completo las entradas de la sesión
  dentro de una única transacción Prisma: `deleteMany` de `StrengthEntry`/`CardioEntry` de esa
  sesión (cascada a `StrengthSet`) seguido de `session.update` con `create` de las nuevas
  entradas — igual que `create-session.ts`, para que la sesión nunca quede en un estado a
  medias si falla algo a mitad.
- `src/lib/delete-session.ts` — borra una sesión existente: misma guarda `findFirst({ id,
  userId })` que `update-session.ts`, seguida de un único `prisma.session.delete`. A diferencia
  de `update-session.ts` (que sustituye entradas y por eso necesita `deleteMany` explícito), el
  borrado no toca `StrengthEntry`/`CardioEntry`/`StrengthSet` directamente: el esquema declara
  `onDelete: Cascade` en esas relaciones, y se comprobó empíricamente (no solo leyendo
  `schema.prisma`) que el adapter `@prisma/adapter-better-sqlite3` aplica esas cascadas en
  runtime — ver DECISIONS.md.
- **UI web (`/historial`)**: `session-history-section.tsx` (`SessionHistorySection`) lista las
  sesiones del usuario (fecha + resumen legible de sus ejercicios), con acciones "Editar"
  (formulario in-place) y "Borrar" (confirmación nativa) — mismo patrón estructural que
  `weight-history-section.tsx`. `historial/page.tsx` llama a `getSessionHistory` y
  `listExercises` (además de `getBodyWeightHistory`), y usa `toSessionHistoryEntry`
  (`src/lib/to-session-history-entry.ts`) para convertir cada sesión de Prisma (campos en
  inglés, `Date`) a la forma en español que espera `SessionEntriesEditor`, serializando la
  fecha a ISO string en el proceso — igual que ya hacía para peso. Server Actions
  `updateSessionEntry`/`deleteSessionEntry` en `historial/actions.ts`, mismo patrón de
  resolución de `userId` desde la sesión de NextAuth (nunca del cliente) que las de peso.

## Backup manual

- `src/lib/create-backup.ts` — usa la API de backup online de `better-sqlite3` (`db.backup()`,
  añadido como dependencia directa junto a `@types/better-sqlite3`) contra una conexión
  read-only separada de la de Prisma, para obtener una copia consistente del fichero SQLite
  incluso con escrituras concurrentes. Tras copiar, registra una fila en el modelo `Backup`
  (`userId` + `createdAt`) — no guarda el fichero, solo la fecha. El path de origen es
  inyectable (parámetro opcional, por defecto derivado de `DATABASE_URL`) para poder testear
  contra un fichero SQLite temporal real en vez de mockear la operación de fichero.
- `src/lib/get-last-backup.ts` — devuelve la fecha del backup más reciente del usuario (o
  `null` si nunca se ha hecho ninguno).
- `src/app/api/backup/route.ts` (`GET`) — genera el backup en un fichero temporal
  (`os.tmpdir()`), lo sirve como descarga (`Content-Disposition: attachment`) y lo borra del
  disco en un `finally`, para no dejar copias residuales en el servidor.
- `src/app/ajustes/page.tsx` + `backup-status.tsx` — página que muestra cuánto hace del último
  backup y un aviso si han pasado 30 días o más (o nunca se ha hecho uno), con el enlace de
  descarga. `BackupStatus` es un componente síncrono y puro (recibe la fecha ya serializada),
  separado del Server Component para poder testear la lógica de aviso sin mockear `auth()`/BD.

## Informe de progreso

- `src/lib/get-progress-report.ts` — única función de dominio (`getProgressReport(userId,
  filters)`) que cubre el caso de uso 5 de SPEC.md §4. Solo capa de dominio por ahora: sin ruta
  API ni UI (llegan en fases futuras — servidor MCP y gráficos web — sobre esta misma función).
  `filters` (`{ ejercicio?, desde?, hasta? }`) se valida con Zod con el mismo criterio de fecha
  ISO opcional que `get-body-weight-history.ts`; `ejercicio` es el nombre del catálogo (no un
  id), igual que en el resto de la capa de dominio.
- Forma de salida (`ProgressReportData`, tipos exportados desde el propio fichero):
  - `bodyWeight: { date, weightKg }[]` — evolución del peso corporal, ordenada ascendente por
    fecha (a diferencia de `/historial`, que muestra lo más reciente primero: aquí alimenta una
    serie temporal/gráfico).
  - `frequency: { totalSessions, sessionsPerWeek, currentStreakWeeks }` — agregados **globales**
    del usuario, nunca filtrados por `ejercicio` (solo por `desde`/`hasta`): SPEC.md §4 pide la
    frecuencia/racha como vista global del entrenamiento, no por ejercicio. `sessionsPerWeek` es
    la media sobre el periodo filtrado si se indica `desde`/`hasta`, o si no sobre el rango
    cubierto por las propias sesiones existentes (evita dividir por un periodo arbitrario
    cuando no hay filtro).
  - `exercise?: { exercise, type, points }` — solo presente si se filtra por `ejercicio` (tras
    comprobar su existencia en `prisma.exercise`, devolviendo `NOT_FOUND` si no existe). Para
    fuerza (`type: "STRENGTH"`), `points` es `{ sessionId, date, maxWeightKg, totalVolumeKg }[]`
    (volumen = Σ reps×peso de las series de ese ejercicio en la sesión). Para cardio
    (`type: "CARDIO"`), `points` es `{ sessionId, date, distanceKm, durationSeconds,
    avgPaceSecPerKm }[]` (paso directo de los campos de `CardioEntry`, todos anulables).
- **Criterio de racha (`currentStreakWeeks`)**: número de semanas ISO 8601 consecutivas —
  empezando por la semana actual (según la fecha real del sistema, no afectada por
  `desde`/`hasta`) y yendo hacia atrás — con al menos una sesión registrada en el conjunto
  filtrado. Se corta en la primera semana sin sesiones, incluida la propia semana actual: si no
  hay sesión esta semana, la racha es 0 aunque hubiera entrenado ininterrumpidamente hasta la
  semana pasada. Implicación a tener en cuenta: si se filtra `hasta` con una fecha pasada, la
  semana "actual" real queda fuera del rango filtrado y la racha da 0 salvo que esa semana esté
  dentro del filtro — comportamiento documentado, no un bug.
- Errores estructurados con el mismo patrón que el resto de la capa de dominio:
  `{ success: false, error: { code: "VALIDATION_ERROR" | "NOT_FOUND", message } }`.

### Comentario de progreso con IA (SPEC.md §14 punto 2)

Segunda integración de IA del proyecto, deliberadamente más simple que la propuesta de sesión
de `/sesion` (ver DECISIONS.md 2026-07-19: son dos integraciones de complejidad distinta a
propósito — no sobre-diseñar la más simple, regla 4 CLAUDE.md).

- `src/lib/progress-comment/generate-progress-comment.ts` — llamada directa a
  `client.messages.create()` de `@anthropic-ai/sdk` (`claude-opus-4-8`), **sin tools ni
  toolRunner**. El `system` es un prompt fijo de coach de fitness; el `ProgressReportData` ya
  calculado por `getProgressReport` viaja serializado como `JSON.stringify` en el mensaje de
  usuario. Nunca lanza hacia quien la llama: cualquier fallo (red, API, respuesta sin bloque de
  texto) se traduce en `{ success: false, error }`.
- `src/lib/progress-comment/save-progress-comment.ts` — `prisma.comentarioProgreso.upsert`
  por `userId`, sobrescribe siempre el comentario anterior (sin histórico).
- `src/lib/progress-comment/get-progress-comment.ts` — lectura simple del comentario guardado,
  usada por `/informe` para mostrarlo ya cargado al entrar en la página.
- Modelo `ComentarioProgreso` (`prisma/schema.prisma`): `userId` único (una fila por usuario),
  `texto`, `generadoEn`. Relación `onDelete: Cascade` con `User`, igual que el resto de modelos
  de un único usuario.
- `src/app/informe/actions.ts` (`generateAndSaveProgressComment`) — Server Action que encadena
  `getProgressReport(userId, {})` (siempre el informe global, sin el filtro de ejercicio que sí
  respetan los gráficos de la misma página) → `generateProgressComment` →
  `saveProgressComment`. `userId` sale siempre de `auth()`, nunca del cliente.
- `src/app/informe/progress-comment.tsx` (`ProgressComment`, componente de cliente con
  `useActionState`) — botón "Generar comentario de progreso" bajo demanda; en éxito muestra el
  comentario recién generado, en fallo un aviso discreto (`role="alert"`) sin sustituir el
  comentario que ya hubiera visible. `src/app/informe/progress-comment-display.tsx`
  (`ProgressCommentDisplay`) es un componente puramente presentacional (recibe `generadoEn` ya
  serializado a ISO string, mismo criterio que `ProgressCharts` de no cruzar `Date` por la
  frontera server/client).
- Autenticación/coste: `ANTHROPIC_API_KEY` (variable de entorno, pago por token — ver
  `.env.example`), nunca en código ni logs. En producción se configura como secret de Fly.io.

## Servidor MCP

- `src/app/api/mcp/route.ts` — única ruta del servidor MCP (SPEC §5 y §4 caso de uso 6):
  expone las 7 tools sobre un solo endpoint (`POST /api/mcp`), en tres pasos, cada uno cortando
  la petición antes de llegar al siguiente si falla:
  1. **Autenticación**: verifica el header `Authorization: Bearer <token>` contra
     `MCP_BEARER_TOKEN` (`src/lib/mcp/auth.ts`, `verifyBearerToken`) antes de tocar Prisma o el
     protocolo MCP. Compara los tokens mediante el hash SHA-256 de ambos con
     `crypto.timingSafeEqual` (no `===` directo) para evitar tanto un timing attack sobre el
     contenido como una fuga de longitud si el token recibido y el esperado miden distinto;
     nunca autentica si `MCP_BEARER_TOKEN` no está configurado. 401 si falla.
  2. **Resolución de usuario**: la app es de un único usuario, así que el `userId` de cada
     tool se resuelve una vez por petición a partir de `ADMIN_USERNAME` (misma variable que ya
     usa el login web) contra Prisma real (`src/lib/mcp/resolve-user.ts`,
     `resolveMcpUserId`) — nunca se deriva dentro de una tool ni se acepta desde el payload MCP.
     500 si no existe: es un fallo de configuración del servidor, no un caso esperable en uso
     normal.
  3. **Servidor MCP**: monta un `McpServer` (SDK oficial `@modelcontextprotocol/sdk`) con las 7
     tools ligadas al `userId` ya resuelto, y lo conecta a un
     `WebStandardStreamableHTTPServerTransport` en **modo stateless**
     (`sessionIdGenerator: undefined`) con `enableJsonResponse: true`.
- **Transporte elegido y por qué**: `WebStandardStreamableHTTPServerTransport` (subpath
  `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`) opera directamente sobre
  `Request`/`Response` estándar de Web, compatible de fábrica con los Route Handlers de Next.js
  App Router — a diferencia de `StreamableHTTPServerTransport` (pensado para
  `http.IncomingMessage`/`ServerResponse` de Node/Express clásico), no hace falta ningún puente
  manual. El modo stateless es obligado en este despliegue: cada invocación de este Route
  Handler puede correr en una instancia serverless distinta, sin estado compartido entre
  peticiones, así que no hay dónde persistir una sesión MCP entre llamadas. Ver DECISIONS.md
  2026-07-18 para el detalle de la investigación del SDK y las implicaciones concretas del modo
  stateless (en particular, que permite a un cliente llamar a una tool sin negociar antes un
  `initialize` en esa misma petición).
- **Estructura de `src/lib/mcp/`** — capa de dominio del servidor MCP, testeada por separado del
  transporte (que se mantiene lo más fino posible):
  - `auth.ts` — `verifyBearerToken(authorizationHeader, expectedToken)`.
  - `resolve-user.ts` — `resolveMcpUserId(prismaLike, username)`, con la misma interfaz mínima
    de Prisma inyectable que ya usa `verify-credentials.ts`.
  - `errors.ts` — `toMcpToolError(error)`, normaliza los dos casos de la capa de dominio que
    devuelven el error como string plano (`create-body-weight.ts`, `create-session.ts`) al
    mismo contrato `{code, message}` que ya usa el resto de funciones de dominio.
  - `schemas.ts` — esquemas Zod de entrada por tool: reutiliza directamente `bodyWeightSchema`
    (peso) y `sessionSchema` (sesión, más `id` para `edit_session`) donde la capa de dominio ya
    los exporta; para los filtros de historial/informe (que solo exportan el tipo, no el
    esquema) declara una forma permisiva — la validación real de esos filtros (incluido el
    refinamiento "desde ≤ hasta") sigue viviendo en la propia función de dominio, sin duplicarla.
  - `tools.ts` — un handler `(userId, input) => Promise<{success:true,data} |
    {success:false,error:{code,message}}>` por cada una de las 7 tools de SPEC §5, envolviendo
    la función de dominio correspondiente y normalizando su error con `toMcpToolError`.
    `edit_session` extrae `id` del input y delega en `updateSession(userId, id, resto)`,
    rechazando con `VALIDATION_ERROR` sin llegar a llamar a Prisma si falta. `list_exercises`
    ignora `userId` e input (catálogo global).
- Cada resultado de tool se traduce a un `CallToolResult` de MCP con `content` (texto JSON, que
  el propio protocolo espera de cualquier tool) y `structuredContent` — `{data: ...}` en éxito,
  `{error: {code, message}, isError: true}` en fallo —, reflejando el contrato de error de
  SPEC §5 dentro del propio protocolo MCP en vez de solo a nivel HTTP.
- Seguridad: por ahora el servidor MCP se protege solo con el token Bearer (ver DECISIONS.md
  2026-07-18, ronda anterior); la segunda capa de VPN Tailscale que especifica SPEC §7 queda
  pendiente hasta migrar al NAS propio de David (ver BACKLOG.md).
- **`/api/mcp` está intencionadamente excluido del middleware de sesión** (`src/proxy.ts`, cuyo
  `matcher` incluye `api/mcp` en el negative lookahead junto a `api/auth`, `_next/static`,
  `_next/image` y `favicon.ico`). Ningún cliente MCP (la skill "sesion-entrenamiento", un chat
  con el conector configurado) tiene cookie de sesión de navegador, así que si esta ruta
  pasara por el middleware, el callback `authorized()` de `auth.config.ts` la redirigiría
  siempre con un 307 a `/login` antes de que `route.ts` llegara a comprobar el Bearer token —
  bug real detectado por QA (confirmado con `curl` contra `next dev`: toda petición a
  `/api/mcp`, con o sin token, recibía 307 en vez de 401/200) y corregido en esta misma ronda.
  Su única capa de autenticación es el Bearer token verificado dentro de la propia ruta: no
  añadir aquí una exigencia de sesión para `/api/mcp`, ni quitar el check de Bearer de
  `route.ts` asumiendo que el middleware ya protege algo. Regresión cubierta por
  `src/proxy.test.ts`, que testea el patrón del `matcher` directamente contra rutas de ejemplo
  (anclado a inicio/fin, aproximando cómo Next.js lo aplica realmente) — `route.test.ts` por sí
  solo no lo habría detectado porque llama a `POST()` directamente, sin pasar por el middleware.
- **Límite conocido del SDK**: cuando el propio `McpServer` rechaza el input de una tool contra
  su `inputSchema` (Zod) *antes* de invocar el handler (p. ej. `log_weight` con `weightKg` no
  numérico), la respuesta es `{content:[...], isError:true}` con el error solo como texto
  plano (`MCP error -32602: ...`) — no lleva `structuredContent.error.code/message` como sí
  ocurre con los errores normalizados por `toMcpToolError` dentro de nuestros propios handlers
  (`tools.ts`). Es un comportamiento del SDK anterior a que nuestro código se ejecute, no un bug
  de esta app; un cliente MCP que dependa de `structuredContent.error` para errores de
  validación de forma (no de negocio) debe tener en cuenta este caso. No se ha corregido por no
  haber una forma trivial de interceptar la validación del propio SDK sin reimplementarla.

## Tests E2E (Playwright)

- Suite en `e2e/` (config en `playwright.config.ts`, raíz del proyecto), separada de Vitest:
  cubre los flujos críticos de móvil de punta a punta en un navegador real — login (éxito y
  credenciales incorrectas), registrar peso corporal, registrar sesión de entreno, "Generar
  propuesta con IA" en `/sesion` y "Generar comentario de progreso" en `/informe`. Se ejecuta
  con `npm run test:e2e`, y en CI en un job `e2e` propio (`.github/workflows/ci.yml`), en
  paralelo al job `test` de Vitest.
- **Emulación móvil**: un único proyecto Playwright (`mobile-chromium`) con el preset
  `devices["Pixel 7"]` — viewport/user-agent/touch de un Android real (SPEC.md §2/§6: uso
  principal desde el navegador del móvil). Se eligió un preset Android en vez de uno "iPhone
  *": los presets de iPhone de Playwright emulan Safari (`defaultBrowserType: "webkit"`), lo
  que exigiría instalar y mantener también el motor WebKit; los presets Android usan Chromium,
  el único motor que instala CI (`npx playwright install chromium`).
- **Mock de la API de Anthropic, no `page.route()`**: las dos llamadas de IA de la app
  (`generateSessionProposal` en `/sesion`, `generateProgressComment` en `/informe`) las hace el
  servidor de Next.js (Server Actions/funciones de servidor), nunca el navegador —
  `page.route()` de Playwright solo intercepta tráfico que sale del contexto del navegador, así
  que no sirve aquí. En su lugar, `e2e/mock-anthropic-server.ts` levanta un servidor HTTP
  mínimo (módulo `http` nativo, sin dependencia nueva) que sustituye a `api.anthropic.com`,
  apuntado vía la variable de entorno `ANTHROPIC_BASE_URL` — el SDK `@anthropic-ai/sdk` la
  respeta de fábrica (`new Anthropic()` sin `baseURL` explícito la lee de
  `process.env.ANTHROPIC_BASE_URL`), así que no hace falta tocar código de producción para
  mockear ambas integraciones. Un único handler basta porque tanto
  `client.messages.create()` como `client.beta.messages.create()` golpean el mismo path,
  `POST /v1/messages` (la variante beta solo añade `?beta=true` a la query string). El mock
  distingue las 3 llamadas reales de la app por el `tool_choice` y los `tools` del body: el
  turno final forzado de la propuesta de sesión (`tool_choice: {type: "tool", name:
  "submit_session_proposal"}`) responde con un bloque `tool_use` cuyo `input` cumple
  `sessionSchema` (referencia un ejercicio real sembrado por `prisma/seed.ts`, "Sentadilla");
  cualquier otra llamada (el turno de exploración de esa misma propuesta, y la llamada única de
  `generateProgressComment`) responde solo con texto y `stop_reason: "end_turn"` — no hace
  falta simular `get_session_history`/`list_exercises` porque el tramo que esta suite prueba es
  la salida estructurada final, no la exploración.
- **Base de datos propia**: `e2e/global-setup.ts` migra (`prisma migrate deploy`) y siembra
  (`prisma/seed.ts`, sin tocarlo — siembra tanto el catálogo de ejercicios como el usuario
  admin) un SQLite separado (`e2e/.tmp/e2e.db`, gitignored) antes de cada ejecución, borrándolo
  primero para partir de un estado determinista. También arranca el mock de Anthropic; al
  devolver una función, esa misma función actúa como `globalTeardown` de Playwright (cierra el
  mock), sin necesitar un fichero aparte.
- **Servidor de la app bajo test**: `next dev` (no `next build && next start`) en el puerto
  3100, con `DATABASE_URL`/`ANTHROPIC_BASE_URL`/`ANTHROPIC_API_KEY`/`AUTH_SECRET`/
  `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` de test inyectados vía `webServer.env` — arranque más
  rápido que un build completo en cada ejecución, y sigue siendo un runtime real de Next.js (a
  diferencia de Vitest/jsdom, que no interpreta `"use client"`/`"use server"` — ver
  DECISIONS.md 2026-07-19 sobre el bug de RSC que solo detectó la verificación en navegador
  real, precisamente el tipo de bug que esta suite E2E cubre ahora en CI sin depender de que
  alguien lo repita a mano).
- **Constantes compartidas**: `e2e/env.ts` centraliza puertos, URLs y credenciales de test
  (incluye el hash bcrypt del password de test, calculado una vez al importar el módulo) para
  que `playwright.config.ts`, `global-setup.ts` y los propios specs no puedan desincronizarse
  entre sí.
- `e2e/support/navigation.ts` (`gotoReady`) espera a `networkidle` tras cada navegación antes
  de interactuar con la página: las comprobaciones de "actionability" de Playwright (visible/
  habilitado/estable) no esperan a que React termine de hidratar un componente `"use client"`,
  así que un click/`selectOption` inmediatamente después de `goto()` puede no hacer nada (se
  detectó así, no es teórico: un test seleccionaba un ejercicio del desplegable y pulsaba
  "Añadir" antes de que el `<select>` estuviera hidratado, y el registro añadido usaba el
  estado inicial de React en vez del valor seleccionado). Es seguro esperar a `networkidle`
  aquí porque el WebSocket de HMR de `next dev` no se queda abierto indefinidamente: Next 16 lo
  bloquea por origen salvo que esté en `allowedDevOrigins` (`next.config.ts` no lo incluye a
  propósito para el propio dev normal en `localhost`, pero sí incluye `127.0.0.1`, el host que
  usa Playwright), así que la red sí llega a quedar inactiva en vez de no resolver nunca.
- **Un único worker**: los specs comparten el mismo SQLite de E2E y se ejecutan en serie
  (`workers: 1`) para evitar condiciones de carrera entre tests que escriben en la misma base
  de datos — la suite es pequeña, así que el coste en tiempo total es asumible.

## Regla ESLint: `local/no-client-import-in-server-file` (BL-001)

- **Qué detecta**: un módulo `"use server"` (Server Actions) que importa, directa o vía el
  alias `@/*`, algo exportado por un fichero `"use client"`. Es exactamente la clase de bug de
  `buildInitialRegistros` (ver DECISIONS.md 2026-07-19 y la sección "Estructura de carpetas
  relevante" más abajo): RSC sustituye los exports de un módulo cliente por referencias opacas
  al empaquetar, así que invocarlos desde el servidor crashea siempre en runtime real, pero ni
  Vitest/jsdom ni `tsc` lo detectan (la directiva `"use client"` es una simple cadena de texto
  sin efecto fuera del bundler de RSC de Next.js).
- **Mecanismo**: regla ESLint custom local (`eslint-rules/no-client-import-in-server-file.mjs`,
  registrada como plugin `local` inline en `eslint.config.mjs`, sin publicar ningún paquete).
  Para cada fichero cuya primera sentencia sea la directiva `"use server"`, resuelve cada
  `ImportDeclaration` a un fichero real en disco (soporta rutas relativas y el alias `@/*` →
  `./src/*`, leyendo `tsconfig.json` — tolerante a los comentarios JSONC que ya usa el propio
  `tsconfig.json` de este proyecto — y probando extensiones `.ts`/`.tsx`/`.js`/`.jsx` e
  `index.*` para directorios) y comprueba si la primera sentencia de ESE fichero es la
  directiva `"use client"`. Si el import no resuelve a un fichero del proyecto (paquete de
  `node_modules`, alias sin configurar), se ignora sin más.
- **Por qué una regla custom y no algo ya existente en el ecosistema** (investigación previa a
  escribir la regla, para no repetirla):
  - `eslint-plugin-react-server-components` (candidato mencionado en BACKLOG.md): su única
    regla relevante (`use-client`) solo detecta si un fichero *debería* llevar `"use client"`
    por su propio contenido (hooks, APIs de navegador, JSX con handlers) — no inspecciona si un
    fichero importa algo de OTRO fichero marcado `"use client"`, que es justo el caso del bug.
  - `@next/eslint-plugin-next` (ya en uso vía `eslint-config-next`): no tiene ninguna regla
    relacionada (solo `no-async-client-component`, sin relación).
  - Convención de carpetas + `no-restricted-imports` por directorio: no aplica en este
    proyecto, donde ficheros `"use server"`/`"use client"` conviven deliberadamente en la misma
    carpeta por ruta de Next.js App Router (p. ej. `src/app/sesion/actions.ts` junto a
    componentes cliente en `src/components/`) — no hay separación de directorio que sirva de
    proxy fiable.
- **Verificación empírica**: además de sus propios tests (`eslint-rules/
  no-client-import-in-server-file.test.ts`, vía `RuleTester` de ESLint), se comprobó
  reproduciendo temporalmente el bug real (reintroduciendo `"use client"` en
  `build-initial-registros.ts`, importado por `app/sesion/actions.ts` vía el alias `@/*`) y
  confirmando que `npm run lint` lo detecta; el cambio se revirtió antes de commitear.

## Estructura de carpetas relevante

- `src/app/` — rutas y páginas (App Router de Next.js).
- `src/components/` — componentes de cliente compartidos entre más de una ruta (a diferencia de
  los componentes colocados dentro de `src/app/<ruta>/`, que son propios de esa ruta). Primer
  y único caso por ahora: `session-entries-editor.tsx` (`SessionEntriesEditor`), compartido
  entre `/sesion` (crear) y `/historial` (editar) — ver DECISIONS.md para el porqué de esta
  carpeta nueva en vez de otra ubicación. La lógica de conversión pura que antes vivía dentro
  de este componente (`buildInitialRegistros`) se movió a `src/lib/session-proposal/
  build-initial-registros.ts`: al no llevar JSX/hooks no necesita la directiva `"use client"`
  del componente, y una Server Action (`app/sesion/actions.ts`) también necesita invocarla —
  RSC no permite llamar desde el servidor a una función exportada por un módulo cliente, ver
  DECISIONS.md 2026-07-19.
- `src/lib/prisma.ts` — instancia singleton del cliente Prisma (evita agotar conexiones SQLite
  por hot-reload en desarrollo).
- `prisma/schema.prisma` — esquema de dominio (ver SPEC.md §3 para la definición funcional).
- `prisma/migrations/` — migraciones versionadas.
- `prisma/seed.ts` — siembra el catálogo cerrado de ejercicios (`npm run prisma:seed`).

## Pendiente de definir en fases futuras del roadmap

- Gráficos de progreso, Dockerfile/despliegue en Fly.io — ver el plan de fases y BACKLOG.md.
  El servidor MCP ya está implementado (ver sección "Servidor MCP" arriba); pendiente solo la
  capa VPN Tailscale sobre él (ver BACKLOG.md).
