# Changelog

Cambios de cada versión generada. Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

Proyecto sin versión publicada todavía.

### Added

- Andamiaje del proyecto: Next.js 16 + TypeScript + Tailwind CSS v4, Prisma sobre SQLite con
  el esquema de dominio completo (usuario, peso corporal, catálogo de ejercicios, sesiones,
  series de fuerza, entradas de cardio) y migración inicial, seed del catálogo de ejercicios,
  Vitest + Testing Library, ESLint + Prettier, endpoint `/api/health`, y CI en GitHub Actions
  (format, lint, typecheck, test en cada push).
- Login con usuario/contraseña (Auth.js v5 + bcrypt), protección de todas las rutas vía
  `proxy.ts`, formulario mobile-first en `/login`, y script `hash-password` para generar el
  hash de la contraseña del único usuario del MVP.
- Registro de peso corporal: formulario mobile-first en `/peso`, validación de dominio
  (`validate-body-weight.ts`) y persistencia compartida (`create-body-weight.ts`) entre el
  endpoint `POST /api/body-weight` y la Server Action del formulario.
- Historial de peso corporal: página `/historial` con listado, edición y borrado de registros
  (`get-body-weight-history.ts`, `update-body-weight.ts`, `delete-body-weight.ts`), endpoints
  `GET /api/body-weight` (con filtro opcional de rango de fechas) y
  `PATCH`/`DELETE /api/body-weight/[id]`. Cada mutación comprueba que el registro pertenece al
  `userId` de la sesión antes de escribir, para que nunca se pueda editar o borrar el dato de
  otro usuario aunque hoy solo exista uno.
- Registro de sesión de entreno: formulario mobile-first en `/sesion` que permite añadir
  varios ejercicios (fuerza o cardio) con el mismo esquema que ya usa la skill
  "sesion-entrenamiento" (series/reps/tempo/peso/RPE para fuerza; duración, distancia,
  frecuencia cardiaca, pasos, kcal, etc. para cardio, todos opcionales). Validación de forma
  con Zod (`validate-session.ts`) y de existencia del ejercicio en el catálogo
  (`create-session.ts`), persistidos en una única transacción Prisma (`Session` +
  `StrengthEntry`/`StrengthSet` o `CardioEntry`) para que no quede una sesión a medias si
  falla la escritura. Endpoint `POST /api/sessions` comparte la misma lógica que la Server
  Action del formulario.
- Backup manual: página `/ajustes` con un botón "Descargar backup" (`GET /api/backup`) que
  genera un volcado de solo datos (sentencias SQL `INSERT` vía Prisma, `.sql`) y lo sirve como
  descarga sin conservar copia en el servidor. Se registra la fecha de cada descarga
  (`create-backup.ts`, modelo `Backup`) para mostrar un aviso en `/ajustes` si han pasado más de
  30 días sin hacer uno o si nunca se ha hecho ninguno. Rediseñado el 2026-07-20 (ver
  DECISIONS.md) para funcionar contra Turso: el mecanismo original (`db.backup()` de
  `better-sqlite3` sobre el fichero SQLite local) dejó de ser viable al no existir fichero local
  en el despliegue serverless.
- Informe de progreso (capa de dominio): `src/lib/get-progress-report.ts`
  (`getProgressReport(userId, filters)`) calcula la evolución del peso corporal, la frecuencia
  de entrenamiento (total de sesiones, media semanal y racha de semanas ISO consecutivas con al
  menos una sesión) y, si se filtra por un ejercicio del catálogo, su serie temporal específica
  (peso máximo y volumen total por sesión para fuerza; distancia, duración y ritmo medio para
  cardio). Aún sin ruta API ni UI — la usarán el futuro servidor MCP
  (`get_progress_report`, SPEC.md §5) y los gráficos web de una fase posterior.
- UI web de informe de progreso (`/informe`): tarjetas de frecuencia de entreno (sesiones
  totales, sesiones/semana, racha actual con nota aclaratoria de su criterio de cálculo —
  cierra parcialmente el punto de BACKLOG.md sobre explicar bien la racha), selector de
  ejercicio controlado por la URL (`ExerciseSelector`) y gráficos de evolución con
  [recharts](https://recharts.org/) (`ProgressCharts`): peso corporal, y — filtrando por
  ejercicio — peso máximo/volumen total (fuerza) o distancia/duración/ritmo medio (cardio),
  cada métrica en su propio gráfico de una sola serie. Los campos de cardio no medidos se
  representan como huecos en la línea, nunca como cero. Estados vacíos explícitos cuando no
  hay datos, y tolerancia a un `ejercicio` en la URL que ya no exista en el catálogo (se
  ignora el filtro en vez de romper la página).
- Comentario de progreso con IA: botón bajo demanda en `/informe` que genera, mediante una
  llamada simple a la API de Mensajes de Claude (`@anthropic-ai/sdk`, sin tools) con el informe
  de progreso ya calculado como contexto, un comentario breve en español sobre las tendencias
  del usuario. Se guarda en el nuevo modelo `ComentarioProgreso` (fila única por usuario,
  sobrescribible — `generate-progress-comment.ts`, `save-progress-comment.ts`,
  `get-progress-comment.ts`) y se muestra ya cargado al entrar en la página. Un fallo (red,
  API) se refleja como aviso discreto, sin afectar a los gráficos de progreso existentes.

- Historial y edición de sesión de entreno: capa de dominio para consultar
  (`get-session-history.ts`, con filtros opcionales de rango de fechas y de nombre de
  ejercicio) y editar (`update-session.ts`) sesiones ya registradas. La edición sustituye por
  completo la fecha y los ejercicios de la sesión dentro de una única transacción Prisma
  (borra las `StrengthEntry`/`CardioEntry` existentes y crea las nuevas), y comprueba antes que
  la sesión pertenece al `userId` dado. Se extrajo `session-entries.ts` de `create-session.ts`
  para compartir la validación de existencia/tipo de ejercicio contra el catálogo entre crear y
  editar una sesión. En esta ronda era solo capa de dominio, sin ruta API ni pantalla web; la UI
  web se añadió después, ver más abajo.
- Servidor MCP (SPEC §5): endpoint único `POST /api/mcp` con las 7 tools completas (`log_weight`,
  `get_weight_history`, `log_session`, `edit_session`, `get_session_history`, `list_exercises`,
  `get_progress_report`) para que la skill "sesion-entrenamiento" (u otro chat con el conector
  configurado) lea y escriba en la misma base de datos que la webapp. Protegido con token Bearer
  (`MCP_BEARER_TOKEN`, comparación segura frente a timing attacks vía hash SHA-256 +
  `crypto.timingSafeEqual`) verificado antes de tocar Prisma o el protocolo MCP; el `userId` se
  resuelve del lado del servidor a partir de `ADMIN_USERNAME`, nunca desde el payload MCP.
  Transporte `WebStandardStreamableHTTPServerTransport` del SDK oficial
  `@modelcontextprotocol/sdk`, en modo stateless (sin sesión compartida entre peticiones, apto
  para despliegue serverless). Capa de dominio del servidor MCP en `src/lib/mcp/` (`auth.ts`,
  `resolve-user.ts`, `errors.ts`, `schemas.ts`, `tools.ts`), testeada por separado del transporte.
  Ver ARCHITECTURE.md y DECISIONS.md 2026-07-18 para el detalle de la integración con Next.js.
- UI web de historial y edición de sesiones de entreno: `/historial` gana `SessionHistorySection`,
  que lista las sesiones del usuario (fecha + resumen legible de sus ejercicios) con acciones
  "Editar" (formulario in-place) y "Borrar" (confirmación nativa), mismo patrón que el historial
  de peso. Nueva capa de dominio `delete-session.ts` (borra la sesión; las entradas de
  fuerza/cardio y sus series se eliminan por cascada del esquema, verificado empíricamente).
  Server Actions `updateSessionEntry`/`deleteSessionEntry` en `historial/actions.ts`. La lógica
  de edición de ejercicios (selección del catálogo, series dinámicas de fuerza, campos de
  cardio) se extrajo de `session-form.tsx` a un componente compartido
  (`src/components/session-entries-editor.tsx`), reutilizado tanto para crear (`/sesion`) como
  para editar (`/historial`) sin duplicar las ~480 líneas originales. Cierra el criterio de
  aceptación de SPEC §13 "editar o borrar cualquier registro existente (peso o sesión)" para
  sesiones, que hasta ahora solo estaba cubierto para peso.

- Navegación global: barra de navegación (`src/components/nav-bar.tsx`) con enlaces a Peso,
  Sesión, Historial, Informe y Ajustes, visible en todas las páginas mediante `layout.tsx`.
  Resalta la ruta activa (`aria-current="page"`) y solo se muestra con sesión iniciada
  (`src/components/nav-bar-gate.tsx`, comprobación de `auth()` del lado del servidor en un
  Server Component separado de `layout.tsx` para poder testearlo con Testing Library). Diseño
  mobile-first con altura de toque de 44px por enlace. `/` deja de ser el scaffold por defecto
  de `create-next-app` y ahora redirige server-side a `/historial` (con sesión) o a `/login`
  (sin ella).

- Propuesta de sesión con IA (SPEC §14 punto 1): botón "Generar propuesta con IA" en
  `/sesion`, junto al registro manual (nunca lo sustituye). Nueva capa de dominio
  `src/lib/session-proposal/` con `@anthropic-ai/sdk` (`toolRunner`, no el Claude Agent SDK —
  ver DECISIONS.md 2026-07-19): lee la skill "sesion-entrenamiento" real como `system` prompt
  (`read-skill.ts`), envuelve `getSessionHistory`/`listExercises` como tools de solo lectura
  con el `userId` cerrado sobre el closure (nunca aceptado del modelo) y fuerza un tercer tool
  `submit_session_proposal` — que reutiliza literalmente `sessionSchema` como su
  `input_schema` — con `tool_choice` en un turno final aparte para garantizar salida
  estructurada (`tools.ts`). `generate-session-proposal.ts` orquesta ambas fases con un
  timeout de 30s (`AbortController`), valida siempre la salida con `validateSession()` antes
  de devolverla, y nunca lanza una excepción. En éxito, la Server Action
  `generateSessionProposalAction` precarga `SessionEntriesEditor` (editable, sin guardar
  directamente); en cualquier fallo muestra un aviso discreto sin romper el formulario manual.

- Suite E2E con Playwright (`e2e/`, `npm run test:e2e`) cubriendo los flujos críticos de móvil
  de punta a punta en un navegador real: login (éxito y credenciales incorrectas), registrar
  peso corporal, registrar sesión de entreno, "Generar propuesta con IA" en `/sesion` y
  "Generar comentario de progreso" en `/informe`. Emulación de un móvil Android (`devices["Pixel
  7"]`, Chromium — SPEC §2/§6). Las dos llamadas de IA se mockean sustituyendo
  `api.anthropic.com` por un servidor HTTP local (`e2e/mock-anthropic-server.ts`) apuntado vía
  `ANTHROPIC_BASE_URL` (respetada de fábrica por `@anthropic-ai/sdk`) en vez de gastar una
  llamada real en cada ejecución — ver DECISIONS.md 2026-07-19 para el porqué frente a
  `page.route()` de Playwright, que no intercepta llamadas servidor-a-servidor. `e2e/
  global-setup.ts` migra y siembra un SQLite propio de E2E antes de cada ejecución. Job `e2e`
  nuevo en CI (`.github/workflows/ci.yml`), en paralelo al job `test` de Vitest.

- **[BL-001]** Regla ESLint local `local/no-client-import-in-server-file`
  (`eslint-rules/no-client-import-in-server-file.mjs`, registrada en `eslint.config.mjs`) que
  detecta si un módulo `"use server"` importa algo exportado por un fichero `"use client"` —
  la clase de bug de `buildInitialRegistros` (Runtime Error 500 determinista, ver más abajo en
  "Fixed" y DECISIONS.md 2026-07-19) que ni `npm test` ni `tsc` pueden detectar, porque la
  directiva `"use client"` solo la interpreta el bundler RSC de Next.js. Resuelve imports
  relativos y el alias `@/*` (leyendo `tsconfig.json`) a ficheros reales en disco y comprueba
  su directiva de cabecera; ignora paquetes de `node_modules`. Probada con 5 casos vía
  `RuleTester` de ESLint (`eslint-rules/no-client-import-in-server-file.test.ts`) y verificada
  empíricamente reproduciendo el bug real (ver DECISIONS.md 2026-07-19).

- **[BL-015]** Ampliada `local/no-client-import-in-server-file` (BL-001) para detectar el mismo
  bug también cuando se cuela vía `import()` dinámico (`ImportExpression`), no solo
  `import`/`export` estático (`ImportDeclaration`). Nuevo visitor `ImportExpression` en la
  misma regla, que reutiliza tal cual `resolveImportToFile` y
  `fileStartsWithClientDirective`; si el argumento del `import()` no es un string literal
  estático (p. ej. `import(variable)` o una template literal con interpolación), la regla no
  tiene forma de saber a qué resuelve y lo ignora, igual que ya hacía con paquetes de
  `node_modules`. Nuevo `messageId` `clientDynamicImportInServerFile` para distinguir en el
  mensaje que el problema viene de un import dinámico. 4 casos nuevos vía `RuleTester`
  (`eslint-rules/no-client-import-in-server-file.test.ts`) y verificada empíricamente
  reproduciendo el bug real vía import dinámico (misma pareja de ficheros que BL-001).

- **[BL-016]** Ampliada `local/no-client-import-in-server-file` (BL-001, BL-015) para seguir la
  cadena de re-exports transitivos vía módulo (`export * from "..."` / `export { a, b } from
  "..."`) cuando el fichero al que resuelve directamente el import es un barrel SIN directiva
  propia: antes la regla se paraba ahí (ni "use client" ni "use server" en ese fichero) y
  dejaba pasar el bug si el barrel a su vez reexportaba de un módulo `"use client"`. Nueva
  función `findTransitiveClientFile`, que recorre esa cadena con un `Set` de rutas visitadas
  compartido en toda la travesía (protección contra ciclos: un fichero ya visitado corta la
  recursión ahí, sin reportar ni entrar en bucle infinito) hasta encontrar un `"use client"`
  (reporta) o un `"use server"`/fin de la cadena/eslabón no resoluble (no reporta). El mensaje
  de error ahora señala el fichero `"use client"` real encontrado al final de la cadena, no el
  barrel intermedio. Los re-exports del fichero intermedio se leen con una regex sobre el
  contenido completo (`readModuleReexportTargets`), no con un parser JS/TS completo — ver
  DECISIONS.md para el porqué. 5 casos nuevos vía `RuleTester`
  (`eslint-rules/no-client-import-in-server-file.test.ts`: barrel sin cliente en la cadena,
  barrel con `export *` hacia cliente, barrel con `export { x }` hacia cliente, cadena de dos
  barrels, ciclo sin cliente) y verificada empíricamente con un barrel real de un salto
  (`src/lib/session-proposal/index.ts`, desechable) delante de la misma pareja de ficheros que
  BL-001/BL-015.

- **[BL-008]** Botón "Cerrar sesión" en la barra de navegación global (`nav-bar.tsx`), con
  confirmación nativa (`window.confirm`, mismo criterio que `DeleteSessionButton`/
  `DeleteWeightButton`) antes de invocar la nueva Server Action `logout()`
  (`src/app/actions.ts`), que llama a `signOut({ redirectTo: "/login" })` de Auth.js. La
  Server Action vive en `src/app/actions.ts` (fuera de cualquier ruta concreta) porque el
  logout lo dispara la nav global, visible en todas las páginas autenticadas, no una sola
  sección de la app.

- **[BL-009]** Menú hamburguesa colapsable en `nav-bar.tsx` por debajo del breakpoint `sm`
  (640px, ya en uso en el resto del proyecto): los 5 enlaces y el botón de logout colapsan
  detrás de un botón (`useState`, `aria-expanded`, `aria-label` "Abrir menú"/"Cerrar menú").
  Se cierra con Escape, con clic fuera del menú (listener `mousedown` en `document`, comparado
  contra un `ref` del `<nav>`), al hacer clic en cualquier enlace, y automáticamente cuando
  cambia la ruta (ajuste de estado durante el render, no en un efecto — evita el aviso de lint
  `react-hooks/set-state-in-effect`). En `sm:` y superior la barra se comporta exactamente
  igual que antes. El contenedor de enlaces alterna las clases Tailwind `hidden`/`flex` (con
  `sm:flex` fijo) según el estado — **no** el atributo nativo `hidden` del elemento, que se
  probó primero pero Tailwind v4 lo neutraliza con `!important` en su Preflight (ver
  DECISIONS.md). Sin librería de menús nueva, TDD (`nav-bar.test.tsx`), y verificado en
  navegador real con Playwright MCP a 375px (abrir/cerrar, Escape, clic fuera, navegación) y a
  1024px (confirma que la barra de escritorio no cambia).

- **[BL-010]** Indicador de sección activa, visible junto al título de cada página: nuevo
  componente `SectionIndicator` (`src/components/section-indicator.tsx`), renderizado una sola
  vez en `src/app/layout.tsx` (no repetido en cada `page.tsx`) justo debajo de `NavBarGate`.
  Deriva el label de `NAV_LINKS` (extraído a `src/lib/nav-links.ts`, fuente única compartida
  ahora con `nav-bar.tsx`) comparando con `usePathname()`; se autooculta (`null`) en rutas que
  no son ninguna de las 5 secciones (`/login`, `/`). No es un breadcrumb jerárquico —
  interpretación deliberada del encargo original, ver DECISIONS.md — sino un refuerzo textual
  plano de la sección activa, útil sobre todo en `/peso`, `/sesion` e `/informe`, cuyo `<h1>`
  (“Registrar peso”, “Registrar sesión”, “Informe de progreso”) no repite literalmente el label
  de la nav (“Peso”, “Sesión”, “Informe”). TDD (`section-indicator.test.tsx`, 7 casos: las 5
  secciones + `/login` + `/`) y verificado en navegador real con Playwright MCP en las 5
  secciones, en claro/oscuro, y en móvil con el menú hamburguesa abierto y cerrado.

- **[BL-005]** Filtro de rango de fechas (`desde`/`hasta`) en `/informe`: nuevo componente
  `DateRangeFilter` (`informe/date-range-filter.tsx`, dos `<input type="date">` nativos,
  mismo patrón controlado-por-URL que `ExerciseSelector`) que actualiza la URL vía
  `useRouter`/`useSearchParams`. `informe/page.tsx` valida y convierte los valores crudos
  `YYYY-MM-DD` de la URL con `parseDateRangeSearchParams` (`informe/parse-date-range.ts`, Zod
  `z.iso.date()`, rechaza formato inválido o fechas de calendario inexistentes) a los límites
  ISO datetime completos que ya esperaba `getProgressReport` (medianoche UTC para `desde`,
  último instante del día en UTC para `hasta`). Un rango inválido a nivel de dominio (p. ej.
  `desde` posterior a `hasta`) reutiliza el mismo fallback ya existente para un `ejercicio`
  inexistente: se ignoran todos los filtros y se muestra el informe general. La card "Racha
  actual" explicita mediante `buildStreakCaption` (`informe/streak-caption.ts`) que
  `currentStreakWeeks` ignora `hasta` y siempre cuenta hacia atrás desde hoy, solo cuando ese
  filtro está realmente aplicado. `ExerciseSelector` se refactorizó para combinar sus cambios
  con los parámetros de URL ya presentes (`buildFilterUrl`, `informe/build-filter-url.ts`) en
  vez de reconstruir la query desde cero, para que el filtro de ejercicio y el de fechas
  convivan sin que uno borre al otro.

- **[BL-006]** Comparar periodos en `/informe`: nuevo selector `ComparisonPeriodSelector`
  (`informe/comparison-period-selector.tsx`, mismo patrón controlado-por-URL vía
  `?comparar=mes|anio`) con dos presets fijos ("Este mes vs. anterior" / "Este año vs.
  anterior" — sin rango libre, decisión de producto). `computeComparisonPeriods`
  (`informe/comparison-periods.ts`) calcula los límites de cada periodo en UTC (mismo
  criterio que BL-005); `page.tsx` lanza dos llamadas extra a `getProgressReport` (periodo
  actual + anterior) usando el ejercicio ya resuelto por el informe general. Los puntos de
  cada periodo se fusionan por día relativo al inicio de su propio periodo (no por fecha
  absoluta) con `alignComparisonSeries` (`informe/align-comparison-series.ts`), dejando huecos
  explícitos donde un periodo no tiene dato ese día — así "este mes" (parcial) y "el mes
  anterior" (completo) quedan alineados día 1 con día 1 aunque tengan duraciones distintas.
  Nuevo componente `ComparisonChart` en `progress-charts.tsx`: mismo `LineChart` de Recharts
  que `SingleMetricChart` pero con dos `<Line>` superpuestas en el mismo eje (decisión de
  producto: gráfico superpuesto, no lado a lado) y leyenda — sustituye el gráfico simple de
  cada métrica actualmente visible (peso corporal, o las métricas del ejercicio filtrado) en
  vez de elegir arbitrariamente una única "métrica principal". La comparación de periodos y el
  rango manual de fechas (BL-005) son mutuamente excluyentes: activar uno borra el otro de la
  URL, tanto desde `ComparisonPeriodSelector` como desde `DateRangeFilter`.

- **[BL-007]** Exportar `/informe` como imagen PNG: botón "Descargar imagen"
  (`informe/export-image-button.tsx`, componente cliente) que captura, con
  [`modern-screenshot`](https://github.com/qq15725/modern-screenshot) (`domToPng`), el
  contenedor `#informe-content` (estadísticas, controles de filtro y gráficos, incluida la
  comparación de periodos si está activa) tal cual se ve en pantalla, y dispara la descarga del
  PNG resultante (`informe-progreso-<YYYY-MM-DD>.png`). Generación 100% client-side, sin cruzar
  la frontera server/cliente ni tocar el servidor. `domToPng` recibe explícitamente
  `backgroundColor: getComputedStyle(document.body).backgroundColor`: sin este ajuste, el fondo
  del PNG queda transparente (blanco en la mayoría de visores) mientras el texto sigue usando
  los colores resueltos del tema activo (p. ej. `dark:text-white/60`), dejando etiquetas casi
  ilegibles en modo oscuro — bug real encontrado en la verificación manual con Playwright MCP,
  no detectado por los tests con jsdom (no interpreta CSS real). También recibe
  `onCloneEachNode: fixSelectedOption`, que corrige un segundo bug de `modern-screenshot`
  (encontrado por QA): sin esto, los `<select>` de `ExerciseSelector`/`ComparisonPeriodSelector`
  aparecían siempre en el PNG con su opción por defecto ("Todos"/"Sin comparar") aunque el
  filtro real estuviera activo y los gráficos de la misma imagen ya lo reflejaran. Ver
  DECISIONS.md.
- Capa de datos del pivote de despliegue a Vercel + Turso (ver DECISIONS.md 2026-07-20):
  cliente Prisma migrado a un único adapter `@prisma/adapter-libsql` (producción y local/tests,
  sustituye a `@prisma/adapter-better-sqlite3`) y nuevo `scripts/apply-turso-migrations.ts` que
  aplica las migraciones generadas en local contra cualquier target libSQL (Turso real o un
  `libsql-server` de CI), con su propia tabla de control para ser idempotente en reintentos.
- Infraestructura de despliegue Vercel + Turso (fase 1, sin credenciales reales aún): job de CI
  `verify-turso-migrations` que prepara la verificación de migraciones contra un `libsql-server`
  real (imagen oficial de Turso), independiente y no bloqueante, con la invocación real del
  script de migraciones marcada como pendiente de fase 2; `vercel.json` mínimo versionable
  (`$schema` + `framework: nextjs`); documentación del guardrail de preview deployments (las
  credenciales de la Turso de producción se marcan como scope Production en el dashboard de
  Vercel, no versionable en config-as-code) y checklist de pasos manuales de fase 2 en
  DECISIONS.md. El endpoint `/api/health` pasa a excluirse del middleware de sesión
  (`proxy.ts`), para que Vercel y los monitores externos reciban un 200 en vez de un 307 a
  `/login`.

### Fixed

- `session.user` no incluía el `id` del usuario autenticado (faltaban los callbacks `jwt` y
  `session` en `auth.config.ts`), lo que hacía que cualquier ruta que dependiera de
  `session.user.id` tratara al usuario como no autenticado. Detectado durante la verificación
  manual de `/peso`.
- `/sesion` no forzaba renderizado dinámico: al ser una ruta protegida por `proxy.ts`, Next
  intentaba prerenderizarla como página estática en `next build` y fallaba al llamar a la base
  de datos (`listExercises()`), sin que la CI lo detectara porque no ejecutaba `build`.
  Detectado al verificar la integración de `feature/historial-peso` y `feature/registro-sesion`
  tras un reinicio del IDE. Corregido con `export const dynamic = "force-dynamic"` y añadido
  un paso de `build` a la CI para que no vuelva a colarse sin avisar.
- Timeout demasiado ajustado en la propuesta de sesión con IA: `DEFAULT_TIMEOUT_MS` en
  `generate-session-proposal.ts` estaba en 30s, pero en pruebas reales con
  `ANTHROPIC_API_KEY` el flujo completo (exploración + turno final) tardó entre ~14s y ~31s,
  haciendo fallar por timeout 3 de 5 pruebas (60%). Subido a 60s (ver DECISIONS.md
  2026-07-19).
- `generateSessionProposalAction` (`/sesion`) crasheaba con un Runtime Error 500 siempre que
  la generación con IA tenía éxito: "Attempted to call buildInitialRegistros() from the server
  but buildInitialRegistros is on the client". `actions.ts` (Server Action, `"use server"`)
  llamaba a `buildInitialRegistros`, exportada por `session-entries-editor.tsx`
  (`"use client"`) — RSC prohíbe invocar desde el servidor una función de un módulo cliente.
  Bug determinista desde la PR de "propuesta de sesión con IA", solo visible verificando en
  navegador real (Playwright), no en `npm test`. Corregido moviendo `buildInitialRegistros` (y
  sus tipos/helpers) a un módulo nuevo sin directiva, `src/lib/session-proposal/
  build-initial-registros.ts`, importable desde cliente y servidor por igual (ver DECISIONS.md
  2026-07-19).
- **[BL-004]** El orden intercalado entre ejercicios de fuerza y cardio (p. ej.
  cardio-fuerza-cardio) no se conservaba al editar una sesión sin cambiar nada: `CardioEntry`
  no tenía campo `order` (a diferencia de `StrengthEntry`), y `resolveSessionEntries` calculaba
  el `order` de fuerza sobre el índice del subarray ya filtrado por tipo, no sobre la posición
  real en la lista mixta original — una sesión cardio-fuerza-cardio se reordenaba a
  fuerza-cardio-cardio en el formulario de edición de `/historial` sin que el usuario tocara
  nada. Sin pérdida de datos, solo reordenamiento visual. Corregido con un campo
  `order Int @default(0)` nuevo en `CardioEntry` (migración no destructiva), calculando el
  `order` de ambos tipos sobre el array `ejercicios` original en `session-entries.ts`, un
  `orderBy: { order: "asc" }` que faltaba en la consulta de `cardioEntries` de
  `get-session-history.ts`, y fusionando (en vez de concatenar en dos bloques) las entradas de
  fuerza y cardio por su `order` en el nuevo `src/lib/to-session-history-entry.ts` (extraído de
  `historial/page.tsx` para poder testearlo de forma aislada). Ver DECISIONS.md 2026-07-19.
