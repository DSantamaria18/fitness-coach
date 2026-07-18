# Features implementadas

Funcionalidades ya implementadas y desplegadas, con su descripción. Se actualiza en cada
cambio relevante.

## Andamiaje del proyecto (sin funcionalidad de producto todavía)

- Proyecto Next.js + TypeScript operativo, con Prisma/SQLite modelando el dominio completo de
  SPEC.md §3 y migración inicial aplicada.
- Catálogo de ejercicios sembrado (`npm run prisma:seed`).
- Suite de tests (Vitest) y pipeline de CI (GitHub Actions) verificando formato, lint,
  typecheck, tests y build en cada push.
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
  y habilitar/deshabilitar su propio botón de guardar sin duplicar esa lógica tampoco. También
  expone `buildInitialRegistros` para convertir una sesión ya guardada (formato de
  `get-session-history.ts`) al estado de edición, usado solo por el formulario de edición.

## Backup manual

- Página `/ajustes` con un botón "Descargar backup" que genera al vuelo una copia consistente
  del fichero SQLite (usando la API de backup online de `better-sqlite3`, segura incluso con
  escrituras concurrentes) y la sirve como descarga del navegador — no se conserva ninguna
  copia en el servidor.
- Cada descarga se registra con su fecha (`create-backup.ts`, modelo `Backup`), y `/ajustes`
  muestra un aviso si han pasado más de 30 días desde el último backup o si nunca se ha hecho
  ninguno (`get-last-backup.ts`).
- Sustituye al plan original de backup diario automático a almacenamiento externo (ver
  DECISIONS.md): al ser una app de un único usuario, un recordatorio en la UI es suficiente y
  evita depender de una cuenta/credenciales de un proveedor cloud.

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
- Pendiente (ver BACKLOG.md): añadir la segunda capa de seguridad (VPN Tailscale) que especifica
  SPEC §7, cuando se migre al NAS propio de David.
