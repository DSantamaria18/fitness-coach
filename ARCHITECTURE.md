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

## Historial y edición de sesión de entreno

- `src/lib/session-entries.ts` — helper extraído de `create-session.ts` (`resolveSessionEntries`):
  valida existencia del ejercicio en el catálogo y que su tipo coincida (contra la base de
  datos, no en Zod) y construye los datos de creación anidada de `StrengthEntry`/`CardioEntry`
  a partir de los ejercicios ya validados por Zod. Compartido entre `create-session.ts` y
  `update-session.ts` porque ambos necesitan exactamente la misma lógica de "ejercicios
  validados → entradas listas para Prisma".
- `src/lib/get-session-history.ts` — consulta las sesiones de un usuario (más recientes
  primero) con sus `strengthEntries` (+ `sets`, ordenadas por `order`) y `cardioEntries`
  incluidos, cada uno con su `exercise` para poder mostrar el nombre sin consultas
  adicionales. Acepta filtros opcionales `desde`/`hasta` (mismo patrón Zod que
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
- Ninguna de las dos funciones expone todavía ruta API ni UI web — solo la capa de dominio,
  a la espera del servidor MCP.

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

## Estructura de carpetas relevante

- `src/app/` — rutas y páginas (App Router de Next.js).
- `src/lib/prisma.ts` — instancia singleton del cliente Prisma (evita agotar conexiones SQLite
  por hot-reload en desarrollo).
- `prisma/schema.prisma` — esquema de dominio (ver SPEC.md §3 para la definición funcional).
- `prisma/migrations/` — migraciones versionadas.
- `prisma/seed.ts` — siembra el catálogo cerrado de ejercicios (`npm run prisma:seed`).

## Pendiente de definir en fases futuras del roadmap

- Gráficos de progreso, Dockerfile/despliegue en Fly.io — ver el plan de fases y BACKLOG.md.
  El servidor MCP ya está implementado (ver sección "Servidor MCP" arriba); pendiente solo la
  capa VPN Tailscale sobre él (ver BACKLOG.md).
