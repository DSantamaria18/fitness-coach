# Features implementadas

Funcionalidades ya implementadas y desplegadas, con su descripción. Se actualiza en cada
cambio relevante.

## Andamiaje del proyecto (sin funcionalidad de producto todavía)

- Proyecto Next.js + TypeScript operativo, con Prisma/SQLite modelando el dominio completo de
  SPEC.md §3 y migración inicial aplicada.
- Catálogo de ejercicios sembrado (`npm run prisma:seed`).
- Suite de tests (Vitest) y pipeline de CI (GitHub Actions) verificando formato, lint,
  typecheck, tests y build en cada push.
- Suite E2E (Playwright, `npm run test:e2e`) cubriendo los flujos críticos de móvil de punta a
  punta en un navegador real (Chromium, emulación Android): login, registrar peso, registrar
  sesión, y las dos generaciones asistidas por IA (`/sesion`, `/informe`), con la API de
  Anthropic sustituida por un mock local — nunca gasta una llamada real. Job `e2e` propio en CI,
  en paralelo al job `test` de Vitest. Ver ARCHITECTURE.md, sección "Tests E2E (Playwright)".
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

## Historial de peso corporal

- Página `/historial` que lista los registros de peso corporal del usuario autenticado
  (más reciente primero), con edición y borrado in-place.
- Capa de dominio (`get-body-weight-history.ts`, `update-body-weight.ts`,
  `delete-body-weight.ts`) que reutiliza la validación de `validate-body-weight.ts` y comprueba
  siempre que el registro pertenece al `userId` dado antes de editarlo o borrarlo — guarda de
  autorización a nivel de dominio, no delegable al caller.
- Endpoints `GET /api/body-weight` (con filtro opcional de rango `desde`/`hasta`),
  `PATCH /api/body-weight/[id]` y `DELETE /api/body-weight/[id]`, pensados para el futuro
  servidor MCP igual que el resto de la API.

## Registro de sesión de entreno

- Formulario mobile-first en `/sesion` para registrar una sesión con uno o varios ejercicios,
  cada uno de tipo fuerza o cardio, con el mismo esquema que ya usa la skill
  "sesion-entrenamiento": series/reps/tempo/peso/RPE para fuerza; duración, distancia,
  velocidad/ritmo medio, frecuencia cardiaca media/máxima, pasos, frecuencia de paso y kcal
  (todos opcionales) para cardio.
- Duración y ritmo medio de cardio se teclean/muestran en formato mm:ss (`Duración (mm:ss)`,
  `Ritmo medio (min:seg/km)`, ej. "8:30"), no en segundos totales: un corredor piensa la
  duración en minutos, no en segundos — el contrato interno (Prisma `durationSeconds`/
  `avgPaceSecPerKm: Int?`, `validate-session.ts`) sigue siendo segundos, la conversión ocurre
  solo en la capa de UI (`src/lib/duration-format.ts`). Un mm:ss con formato inválido (no
  vacío) muestra un aviso inline en vez de guardarse en silencio como si no se hubiera
  informado. Los campos numéricos con decimales (peso, distancia, velocidad media, cadencia)
  aceptan indistintamente coma o punto como separador decimal, con un placeholder de ejemplo
  ("ej: 82,5") para que el formato quede claro. Ver DECISIONS.md.
- Validación de forma con Zod (`validate-session.ts`) y de existencia del ejercicio en el
  catálogo, incluyendo que su tipo (fuerza/cardio) coincida (`create-session.ts`) — la
  existencia se valida contra la base de datos, no en el esquema Zod puro.
- Persistencia en una única transacción Prisma (`Session` junto con sus `StrengthEntry` +
  `StrengthSet`, o `CardioEntry`), para que nunca quede una sesión huérfana si falla la
  escritura de algún ejercicio a mitad.
- Endpoint `POST /api/sessions` comparte la misma lógica de dominio que la Server Action del
  formulario `/sesion` (mismo patrón que peso: una sola fuente de verdad).
- La página `/sesion` fuerza renderizado dinámico (`export const dynamic = "force-dynamic"`)
  por estar protegida por `proxy.ts`: nunca puede servirse como contenido estático generado en
  build time.

## Historial y edición de sesión de entreno

- Capa de dominio: `get-session-history.ts` (consulta), `update-session.ts` (edición) y
  `delete-session.ts` (borrado) para las sesiones de entreno ya registradas.
- Consulta de historial de sesiones (más recientes primero) con sus ejercicios de fuerza
  (series incluidas) y de cardio, cada uno con el nombre del ejercicio. Filtrable por rango de
  fechas (`desde`/`hasta`) y, opcionalmente, por nombre de ejercicio: devuelve las sesiones que
  contienen ese ejercicio en cualquiera de sus entradas de fuerza o cardio.
- Edición de una sesión existente: sustituye por completo su fecha y sus ejercicios (mismo
  esquema de validación que al crearla, incluyendo la comprobación de que cada ejercicio existe
  en el catálogo y su tipo coincide), dentro de una única transacción Prisma para que la sesión
  nunca quede en un estado a medias si falla algo a mitad. Comprueba primero que la sesión
  pertenece al usuario autenticado — guarda de autorización a nivel de dominio, no delegable al
  caller.
- Borrado de una sesión existente (`delete-session.ts`): misma guarda de pertenencia por
  `userId` que la edición y que el borrado de peso corporal. No hace falta borrar a mano las
  entradas de fuerza/cardio ni sus series: el esquema declara `onDelete: Cascade` en esas
  relaciones, verificado empíricamente contra el adapter `@prisma/adapter-better-sqlite3` (no
  deja registros huérfanos — ver DECISIONS.md).
- Lógica de resolución de ejercicios contra el catálogo (`session-entries.ts`) extraída y
  compartida entre el registro y la edición de sesiones, para no duplicar esa validación entre
  ambos flujos.
- Una sesión que intercala ejercicios de fuerza y cardio (p. ej. cardio-fuerza-cardio) conserva
  ese orden relativo al editarse y al releerse, aunque `StrengthEntry`/`CardioEntry` vivan en
  tablas separadas: ambas comparten un campo `order` calculado sobre la posición real en la
  lista de ejercicios original (no sobre el índice de cada subarray filtrado por tipo), y
  `to-session-history-entry.ts` fusiona ambos arrays por ese campo antes de exponer la sesión al
  formulario de edición (BL-004, ver DECISIONS.md 2026-07-19).
- **UI web en `/historial`**: `SessionHistorySection` lista las sesiones del usuario (fecha +
  resumen legible de cada ejercicio — series para fuerza, métricas rellenas para cardio), con
  acciones "Editar" (formulario in-place, prefilled) y "Borrar" (confirmación nativa del
  navegador, mismo patrón que el historial de peso). El formulario de edición reutiliza el
  mismo componente `SessionEntriesEditor` que `/sesion` usa para crear sesiones — ver
  "Componente compartido de edición de sesión" más abajo. Server Actions
  `updateSessionEntry`/`deleteSessionEntry` en `historial/actions.ts` resuelven el `userId`
  desde la sesión de NextAuth, nunca del cliente. Cierra el criterio de aceptación de SPEC §13
  "puede editar o borrar cualquier registro existente (peso o sesión)", que hasta ahora solo
  cubría peso.

## Componente compartido de edición de sesión

- `src/components/session-entries-editor.tsx` (`SessionEntriesEditor`): extraído de
  `session-form.tsx` para no duplicar la lógica de selección de ejercicio del catálogo, series
  dinámicas de fuerza y campos de cardio (~480 líneas) entre el formulario de creación
  (`/sesion`) y el de edición (`/historial`). Recibe `registros`/`onRegistrosChange` como prop
  controlado por el componente padre (no como estado interno), para que tanto `SessionForm`
  como el formulario de edición de `/historial` puedan conocer el número de ejercicios añadidos
  y habilitar/deshabilitar su propio botón de guardar sin duplicar esa lógica tampoco.
- `src/lib/session-proposal/build-initial-registros.ts` — conversor puro (`buildInitialRegistros`,
  sin JSX ni hooks) de ejercicios ya guardados (formato de `get-session-history.ts`) o
  propuestos por la IA (`ValidatedSession.ejercicios`, estructuralmente compatible) al estado
  local de `SessionEntriesEditor`. Vive fuera de `session-entries-editor.tsx` (que sí es
  `"use client"`) porque también lo invoca la Server Action `generateSessionProposalAction`
  (ver "Propuesta de sesión con IA" más abajo) — RSC prohíbe llamar desde el servidor a una
  función exportada por un módulo cliente, ver DECISIONS.md 2026-07-19.
- `src/lib/duration-format.ts` — conversores puros `parseMinutesSeconds`/
  `formatSecondsAsMinutesSeconds` entre el mm:ss que teclea/lee un corredor ("8:30") y los
  segundos totales del contrato existente. Usados por `session-entries-editor.tsx` (parseo al
  construir el payload de guardado) y por `build-initial-registros.ts`/el resumen de solo
  lectura de `/historial` (formateo al precargar/mostrar una sesión ya guardada).

## Backup manual

- Página `/ajustes` con un botón "Descargar backup" que genera al vuelo un volcado de solo
  datos (sentencias SQL `INSERT`, vía Prisma) y lo sirve como descarga del navegador
  (`fitness-coach-backup-YYYY-MM-DD.sql`) — no se conserva ninguna copia en el servidor.
  Revisado el 2026-07-20 (ver DECISIONS.md): sustituye a la copia binaria del fichero SQLite
  con `better-sqlite3`, inservible contra Turso al no haber fichero local en producción.
- Cada descarga se registra con su fecha (`create-backup.ts`, modelo `Backup`), y `/ajustes`
  muestra un aviso si han pasado más de 30 días desde el último backup o si nunca se ha hecho
  ninguno (`get-last-backup.ts`).
- Sustituye al plan original de backup diario automático a almacenamiento externo (ver
  DECISIONS.md): al ser una app de un único usuario, un recordatorio en la UI es suficiente y
  evita depender de una cuenta/credenciales de un proveedor cloud.

## Gestión del catálogo de ejercicios

- Nueva sección "Catálogo de ejercicios" en `/ajustes`, junto a `BackupStatus`: permite dar de
  alta, renombrar (nombre y/o tipo) y borrar ejercicios sin tocar `prisma/seed.ts` ni
  re-sembrar la base de datos — soluciona el problema real que lo motivó (ejercicios que
  faltaban o sobraban en el desplegable de "añadir ejercicio" de `/sesion`, p. ej. "press de
  banca con mancuernas" ausente o "Bicicleta" sobrante).
- Capa de dominio (`src/lib/create-exercise.ts`, `rename-exercise.ts`, `delete-exercise.ts`),
  mismo estilo de result type `{success:true,data}|{success:false,error:{code,message}}` que
  `create-session.ts`/`update-session.ts`/`delete-session.ts`. Validación compartida
  (`validate-exercise.ts`, Zod): nombre no vacío (recortado) y tipo `STRENGTH`/`CARDIO`.
  Catálogo global, sin `userId` (igual que `list-exercises.ts`) — la autenticación se exige en
  la Server Action (`src/app/ajustes/actions.ts`), no en la capa de dominio.
- El borrado es real (no soft-delete): si el ejercicio ya tiene `StrengthEntry`/`CardioEntry`
  asociadas, la FK constraint de la base de datos lo bloquea (Prisma `P2003`), traducido a un
  mensaje claro ("No se puede eliminar: ya tiene sesiones registradas.") en vez de un error 500
  — ver DECISIONS.md para la justificación completa.
- Tras cualquier alta/renombrado/borrado con éxito se revalida tanto `/ajustes` como `/sesion`:
  el desplegable de "añadir ejercicio" de `/sesion` lee del mismo catálogo y debe reflejar el
  cambio de inmediato.
- El comentario de `schema.prisma` sobre `Exercise` ("catálogo cerrado") queda desactualizado
  por esta feature y se corrige en el propio esquema.

## Navegación global

- Barra de navegación (`src/components/nav-bar.tsx`, client component) con enlaces a Peso,
  Sesión, Historial, Informe y Ajustes, visible en todas las páginas vía `layout.tsx`. Resalta
  la ruta activa con `aria-current="page"` (comparando con `usePathname()`).
- Solo se muestra con sesión iniciada: `src/components/nav-bar-gate.tsx` (Server Component,
  separado de `layout.tsx` para poder testearse con Testing Library sin arrastrar la envoltura
  `<html>/<body>`) comprueba `auth()` del lado del servidor y omite la nav por completo si no
  hay usuario autenticado, para no mostrar la estructura de navegación en `/login`.
- Diseño mobile-first: fila horizontal de enlaces con altura de toque de 44px cada uno (uso
  principal desde el móvil, ver SPEC.md §2/§6).
- `/` deja de ser el scaffold por defecto de `create-next-app`: ahora redirige server-side a
  `/historial` si hay sesión, o a `/login` si no la hay (defensa en profundidad además de la
  protección ya existente en `src/proxy.ts`).
- **[BL-008]** Botón "Cerrar sesión" al final de la barra de navegación. Pide confirmación
  nativa (`window.confirm`) y, si se confirma, invoca la Server Action `logout()`
  (`src/app/actions.ts`), que llama a `signOut({ redirectTo: "/login" })` de Auth.js.
- **[BL-009]** Menú hamburguesa por debajo del breakpoint `sm` (640px): los 5 enlaces y el botón
  de logout colapsan detrás de un botón con `aria-expanded`/`aria-label` ("Abrir menú"/"Cerrar
  menú"), estado `useState`. Se cierra al pulsar Escape, al hacer clic fuera del menú, al hacer
  clic en cualquier enlace (además de al navegar realmente), y automáticamente en cuanto cambia
  la ruta. En `sm:` y superior la barra se comporta exactamente igual que antes (fila
  horizontal, sin hamburguesa). Sin librería de menús — un `useState` más las clases
  `hidden`/`flex`/`sm:flex` de Tailwind ya establecidas en el proyecto.
- **[BL-010]** Indicador de sección activa (`SectionIndicator`) junto al título de cada página,
  derivado de la misma fuente que la nav-bar (`NAV_LINKS`). No es un breadcrumb jerárquico —
  la app solo tiene un nivel de navegación (5 secciones planas) — sino un refuerzo textual de
  qué sección estás viendo, útil sobre todo donde el `<h1>` de la página no repite literalmente
  el label de la nav (p. ej. "Registrar peso" en `/peso`, cuyo label en la nav es "Peso"). Se
  autooculta fuera de las 5 secciones (`/login`, `/`).

## Informe de progreso

- `src/lib/get-progress-report.ts` — función `getProgressReport(userId, filters)` que calcula,
  sobre datos ya persistidos, la evolución del peso corporal, la frecuencia de entrenamiento
  (sesiones totales, media semanal y racha de semanas ISO consecutivas con al menos una
  sesión) y, si se filtra por un ejercicio del catálogo, su serie temporal específica: peso
  máximo y volumen total por sesión (fuerza), o distancia/duración/ritmo medio (cardio).
  Filtro opcional de rango de fechas (`desde`/`hasta`), mismo criterio de validación que el
  resto de la capa de dominio; devuelve `NOT_FOUND` si el ejercicio filtrado no existe en el
  catálogo. Reutilizada tanto por la UI web como (pendiente) por el futuro servidor MCP
  (`get_progress_report`, SPEC.md §5).
- **UI web en `/informe`**: cabecera con tarjetas de frecuencia (sesiones totales, sesiones/
  semana y racha actual, con una nota aclaratoria de que la racha cuenta hacia atrás desde hoy
  — ver DECISIONS.md), un selector de ejercicio (`ExerciseSelector`, componente de cliente
  controlado por la URL vía `?ejercicio=`, sin estado de formulario propio) y los gráficos de
  progreso (`ProgressCharts`, con [recharts](https://recharts.org/)):
  - Evolución del peso corporal (línea temporal), con mensaje de estado vacío si no hay
    registros todavía.
  - Filtrando por un ejercicio de fuerza: peso máximo y volumen total por sesión, cada métrica
    en su propio gráfico de una sola serie (no combinadas en un único eje — ver DECISIONS.md).
  - Filtrando por un ejercicio de cardio: distancia, duración y ritmo medio por sesión, cada
    métrica en su propio gráfico; los campos no medidos en una sesión concreta (`null`, no
    todos los relojes miden todo) se representan como huecos en la línea, nunca como cero, y si
    ninguna sesión tiene ese dato se muestra un aviso en vez de un gráfico vacío.
  - Si el ejercicio del query param ya no existe en el catálogo, la página ignora el filtro y
    muestra el informe general en vez de romperse.
- **[BL-005] Filtro de rango de fechas**: `DateRangeFilter` añade dos `<input type="date">`
  ("Desde"/"Hasta") controlados por la URL (`?desde=&hasta=`), mismo patrón que
  `ExerciseSelector`. Los valores se validan y convierten en `page.tsx` a los límites de día
  completos que espera `getProgressReport`; un rango inválido (formato erróneo, fecha de
  calendario inexistente, o `desde` posterior a `hasta`) se ignora igual que un `ejercicio`
  obsoleto, mostrando el informe general. El filtro de ejercicio y el de fechas conviven en la
  misma URL sin pisarse entre sí. Como `currentStreakWeeks` siempre cuenta hacia atrás desde
  hoy e ignora `hasta` (ver DECISIONS.md 2026-07-18), la card "Racha actual" añade una nota
  explícita de ese comportamiento solo cuando `hasta` está realmente aplicado.
- **[BL-006] Comparar periodos**: `ComparisonPeriodSelector` añade un desplegable ("Sin
  comparar" / "Este mes vs. anterior" / "Este año vs. anterior" — solo presets fijos, sin
  rango libre) controlado por la URL (`?comparar=mes|anio`). Al activarse, cada gráfico de
  métrica individual actualmente visible (peso corporal, o las métricas del ejercicio
  filtrado) se sustituye por un gráfico comparativo superpuesto con dos series (periodo actual
  vs. periodo anterior), alineadas por "día relativo al inicio del periodo" en vez de por
  fecha absoluta, para que el día 1 de un mes quede debajo del día 1 del otro aunque tengan
  duraciones distintas (el mes en curso es parcial hasta hoy). Mutuamente excluyente con el
  filtro de rango de fechas manual (BL-005): activar uno borra el otro de la URL.
- **Comentario de progreso con IA** (SPEC.md §14 punto 2): botón "Generar comentario de
  progreso" en `/informe`, bajo demanda (nunca automático). Llama a un Server Action que
  encadena `getProgressReport(userId, {})` (informe global, sin filtro de ejercicio) →
  `generateProgressComment` (llamada simple a `client.messages.create()` de
  `@anthropic-ai/sdk`, sin tools ni toolRunner — el informe serializado viaja como contexto de
  la llamada) → `saveProgressComment` (upsert en el modelo `ComentarioProgreso`, fila única por
  usuario: cada generación sobrescribe la anterior, sin histórico). El comentario guardado se
  carga y se muestra ya al entrar en `/informe`, antes de pulsar el botón
  (`getProgressComment`). En fallo (red, API, respuesta vacía) se muestra un aviso discreto sin
  tocar los gráficos existentes, y el último comentario visible (guardado o generado en esta
  misma sesión de navegador) se mantiene.
- **[BL-007] Exportar como imagen PNG**: botón "Descargar imagen" (`ExportImageButton`) junto
  al título de `/informe`, que genera un PNG del contenido actual del informe (estadísticas,
  filtros y gráficos, incluida la comparación de periodos si está activa) tal cual se ve en
  pantalla en ese momento, y dispara su descarga con nombre
  `informe-progreso-<YYYY-MM-DD>.png`. Generación puramente client-side (captura del DOM ya
  renderizado con [`modern-screenshot`](https://github.com/qq15725/modern-screenshot)), sin
  llamada al servidor. Aviso discreto si la generación falla, sin romper la página (mismo
  criterio que el resto de fallos de `/informe`). Ver ARCHITECTURE.md y DECISIONS.md.

## Propuesta de sesión con IA

- Botón "Generar propuesta con IA" en `/sesion`, junto al formulario manual (nunca lo
  sustituye — SPEC §4 caso de uso 7): invoca `generateSessionProposal(userId)` vía Server
  Action (`generateSessionProposalAction` en `app/sesion/actions.ts`) y, en éxito, precarga
  `SessionEntriesEditor` (fecha + ejercicios, convertidos con `buildInitialRegistros` — ver
  "Componente compartido de edición de sesión" más arriba) con el resultado — sigue siendo
  editable antes de guardar, y el guardado real sigue pasando por el flujo de creación de
  sesión ya existente sin cambios.
- `src/lib/session-proposal/read-skill.ts` — lee `skills/sesion-entrenamiento/SKILL.md` del
  filesystem del servidor y separa el frontmatter YAML del cuerpo Markdown; solo el cuerpo se
  usa como `system` prompt. Es el único punto del código que toca ese fichero (contiene datos
  personales de salud de David): no se sirve crudo por ningún endpoint ni se loguea.
- `src/lib/session-proposal/tools.ts` — tres tools de `@anthropic-ai/sdk`
  (`betaZodTool`/`toolRunner`, no el Claude Agent SDK — ver DECISIONS.md 2026-07-19):
  `get_session_history` y `list_exercises`, de solo lectura, envuelven las funciones de
  dominio ya existentes; `submit_session_proposal` reutiliza literalmente `sessionSchema` de
  `validate-session.ts` como su `input_schema` (no un esquema "equivalente" redefinido a
  mano) y es el mecanismo de salida estructurada, forzado con `tool_choice` en un turno
  final aparte — nunca se confía en que el modelo devuelva JSON en texto libre. El `userId`
  se cierra sobre el closure de cada tool en el momento de construirla: ningún input_schema
  lo declara, así que el modelo no puede rellenarlo (mismo patrón que
  `src/lib/mcp/resolve-user.ts`).
- `src/lib/session-proposal/generate-session-proposal.ts` — orquesta la llamada en dos fases:
  una exploración con `client.beta.messages.toolRunner()` (tool_choice automático, hasta 6
  turnos) sobre los dos tools de solo lectura, y una única llamada final
  (`client.beta.messages.create()`) con la conversación acumulada, forzando `tool_choice` al
  tool de salida. Timeout de 60s vía `AbortController` compartido entre ambas llamadas (ver
  DECISIONS.md 2026-07-19: con 30s, un 60% de las pruebas reales fallaba por timeout). La
  salida se valida siempre con `validateSession()` antes de devolverse — se trata como
  entrada no confiable, igual que un formulario manual. Devuelve un resultado discriminado
  (`{success:true,data}` / `{success:false,error:{code,message}}`), nunca lanza una excepción
  salvo bug real.
- Cualquier fallo (timeout, salida inválida, sin propuesta, error de red/API) se traduce en un
  aviso discreto en `/sesion` sin romper el flujo manual, que sigue disponible tal cual.

## Regla ESLint: detección de imports "use client" en módulos "use server" (BL-001)

- Regla ESLint custom local (`local/no-client-import-in-server-file`, activa en `npm run lint`
  y en el editor) que detecta si un módulo `"use server"` importa algo exportado por un
  fichero `"use client"` — la clase de bug de `buildInitialRegistros` (Runtime Error 500
  determinista, ver DECISIONS.md 2026-07-19) que ni `npm test` ni `tsc` pueden detectar.
  Detalle técnico completo (mecanismo de resolución de imports y por qué las alternativas del
  ecosistema no servían) en ARCHITECTURE.md.

## Servidor MCP

- Endpoint único `POST /api/mcp` que expone 7 tools para que la skill de Claude
  "sesion-entrenamiento" (u otro chat con el conector MCP configurado) lea y escriba
  directamente en la misma base de datos que la webapp, en vez de depender de un JSON local
  (SPEC §4 caso de uso 6):
  - `log_weight` — registra el peso corporal de una fecha (hoy u otra pasada).
  - `get_weight_history` — consulta el historial de peso, con filtro opcional de rango de
    fechas.
  - `log_session` — registra una sesión de entreno con uno o varios ejercicios de fuerza y/o
    cardio (mismo esquema serie/reps/tempo/peso/RPE que ya usa la skill).
  - `edit_session` — edita una sesión existente (sustituye por completo su fecha y ejercicios).
  - `get_session_history` — consulta el historial de sesiones, con filtro opcional de fechas
    y/o ejercicio.
  - `list_exercises` — lista el catálogo cerrado de ejercicios disponibles.
  - `get_progress_report` — informe de progreso (peso corporal, frecuencia de entreno y,
    filtrando por ejercicio, su evolución específica).
- Seguridad: cada petición exige un token Bearer válido (`MCP_BEARER_TOKEN`), comparado de
  forma segura frente a timing attacks (hash SHA-256 + `crypto.timingSafeEqual`), verificado
  antes de tocar cualquier otra cosa. El `userId` de cada tool se resuelve del lado del
  servidor a partir de `ADMIN_USERNAME` (la app es de un único usuario) — nunca se acepta desde
  el payload MCP.
- Transporte **stateless**: cada petición HTTP es independiente, sin sesión MCP compartida
  entre llamadas — apto para un despliegue serverless donde no se puede asumir continuidad de
  proceso entre peticiones (ver ARCHITECTURE.md y DECISIONS.md 2026-07-18 para el detalle).
- Errores estructurados `{ code, message }` en todos los casos, tanto los propios de cada tool
  (validación, "no encontrado") como los normalizados desde la capa de dominio.
- La segunda capa de seguridad (VPN Tailscale) que especificaba originalmente SPEC §7 se
  descartó de forma permanente al pivotar el despliegue a Vercel (serverless, no puede unirse a
  una VPN) — token Bearer es la única capa, decisión explícita de David (ver DECISIONS.md
  2026-07-20).

## Skill "sesion-entrenamiento" standalone usa el servidor MCP real (BL-024/BL-025)

- `skills/sesion-entrenamiento/SKILL.md` (usada por David en cualquier chat de Claude Code
  fuera de la webapp) ya no depende de `entrenamiento-historial.json` local: usa las tools
  `list_exercises` (catálogo cerrado real, nunca propone un ejercicio inexistente en la BD),
  `get_session_history` (rotación de sesiones y regla de variedad de las 2 sesiones anteriores
  del mismo tipo), `log_session` (persiste la sesión generada de inmediato) y `edit_session`
  (corrige a posteriori el peso real o RPE de una sesión ya registrada) del servidor MCP de la
  app como única fuente de verdad.
- Sin fallback: si el conector MCP no está disponible en una sesión de Claude Code dada, la
  skill lo dice explícitamente y no genera ninguna sesión sin poder consultar antes el catálogo
  e historial reales — nunca cae de vuelta al JSON local en silencio.
- README.md documenta cómo conectar de verdad Claude Code al servidor MCP desplegado
  (`claude mcp add --scope user --transport http --header "Authorization: Bearer <token>" ...`)
  y cómo verificar la conexión (`claude mcp list`, `/mcp`).
- Este mismo `SKILL.md` sigue siendo también el `system` prompt literal de la generación
  asistida por IA in-app (`read-skill.ts`); su comportamiento no cambia, porque esa integración
  ya usaba internamente el equivalente de `get_session_history`/`list_exercises` y fuerza su
  propio turno final con `submit_session_proposal` (ver DECISIONS.md 2026-07-21).

## Preview deployments de Vercel sin Turso: SQLite efímero en `/tmp` (BL-018)

- Las credenciales de Turso (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`) tienen scope
  Production-only en el dashboard de Vercel (guardrail deliberado, ver DECISIONS.md
  2026-07-20 "Infra fase 1"), así que un preview deployment (uno por PR) nunca las recibe.
  `resolveDatasourceConfig()` (`src/lib/prisma-datasource-config.ts`) detecta ese caso —
  `VERCEL_ENV` definida y distinta de `"production"`, sin `TURSO_DATABASE_URL` — y usa
  `file:/tmp/preview.db` en vez de caer en silencio a un fichero local que no persiste en el
  runtime serverless. Sin cambios en producción (Turso) ni en local/CI (sin `VERCEL_ENV`).
- Como `/tmp` está vacío en cada cold start de la función serverless, `src/lib/prisma.ts`
  aplica el esquema completo de `prisma/migrations/` contra ese fichero antes de servir la
  primera petición (`src/lib/bootstrap-preview-schema.ts`, reutilizando la misma lógica de
  aplicación de migraciones que ya usa `scripts/apply-turso-migrations.ts` para Turso), una
  única vez por instancia — mismo patrón de guarda que el singleton anti-hot-reload de Prisma.
  El fichero es completamente efímero: se destruye con la instancia serverless, nunca
  compartido entre invocaciones ni con producción.
- Ver DECISIONS.md 2026-07-20 ("BL-018: SQLite efímero en `/tmp` para preview deployments sin
  Turso") para la justificación completa, incluida la excepción documentada a la regla de que
  `resolveDatasourceConfig` es agnóstico de entorno.
