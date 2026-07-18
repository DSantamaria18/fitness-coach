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

- Capa de dominio (`get-session-history.ts`, `update-session.ts`) para consultar y editar
  sesiones de entreno ya registradas — todavía sin ruta API ni pantalla web, a la espera del
  servidor MCP que se construirá encima.
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
- Lógica de resolución de ejercicios contra el catálogo (`session-entries.ts`) extraída y
  compartida entre el registro y la edición de sesiones, para no duplicar esa validación entre
  ambos flujos.

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

## Informe de progreso (capa de dominio)

- `src/lib/get-progress-report.ts` — función `getProgressReport(userId, filters)` que calcula,
  sobre datos ya persistidos, la evolución del peso corporal, la frecuencia de entrenamiento
  (sesiones totales, media semanal y racha de semanas ISO consecutivas con al menos una
  sesión) y, si se filtra por un ejercicio del catálogo, su serie temporal específica: peso
  máximo y volumen total por sesión (fuerza), o distancia/duración/ritmo medio (cardio).
  Filtro opcional de rango de fechas (`desde`/`hasta`), mismo criterio de validación que el
  resto de la capa de dominio; devuelve `NOT_FOUND` si el ejercicio filtrado no existe en el
  catálogo.
- Todavía sin ruta API ni interfaz web: solo la capa de dominio, pensada para reutilizarse tanto
  desde el futuro servidor MCP (`get_progress_report`, SPEC.md §5) como desde los gráficos de
  progreso de la interfaz web.

Aún no hay ruta/UI de informe de progreso ni conexión MCP con la cuenta de Claude — llegan en
las siguientes fases del roadmap.
