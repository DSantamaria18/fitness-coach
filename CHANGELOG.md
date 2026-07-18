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
  genera un snapshot consistente del SQLite en el momento (`db.backup()` de `better-sqlite3`,
  válido incluso con escrituras concurrentes) y lo sirve como descarga sin conservar copia en
  el servidor. Se registra la fecha de cada descarga (`create-backup.ts`, modelo `Backup`) para
  mostrar un aviso en `/ajustes` si han pasado más de 30 días sin hacer uno o si nunca se ha
  hecho ninguno.
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
