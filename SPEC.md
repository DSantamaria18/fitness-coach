# Especificación — Fitness Coach (MVP / Iteración 1)

Estado: **aprobado** por David el 2026-07-16. Cualquier cambio posterior a este documento debe
reflejarse aquí y anotarse en [DECISIONS.md](DECISIONS.md).

## 1. Visión y alcance

Webapp personal de seguimiento de fitness para un único usuario (David), accedida desde el
navegador del móvil. Es la **fuente de verdad** del historial de entrenamiento que hoy vive en
un JSON local usado por la skill de Claude "sesion-entrenamiento"; esa skill (u otros chats de
Claude) debe poder leer y escribir en ella a través de un servidor MCP.

El MVP cubre: registro de peso corporal, registro de sesiones de entreno (ejercicios de fuerza
y de cardio, cada uno con sus métricas propias), edición/borrado de registros pasados, consulta
de historial, e informe de progreso básico. No se migra el histórico JSON existente — la app
arranca en limpio.

Quedan fuera del MVP (ver [sección 12](#12-fuera-de-alcance-del-mvp-backlog)): wearables,
fotos/medidas/comidas, login con huella (passkey), gamificación, comparativas avanzadas.

A partir de esta ampliación (2026-07-19), la app también puede generar contenido asistido por
IA en dos puntos concretos: una propuesta de sesión editable (reutilizando la skill
"sesion-entrenamiento" ya existente) y un comentario de progreso bajo demanda. Ver
[sección 14](#14-generación-asistida-por-ia).

## 2. Usuarios y contexto de uso

Un único usuario. Acceso principal desde el navegador del móvil. La infraestructura vive en un
NAS/servidor propio de David, expuesta únicamente a través de una red privada Tailscale (VPN) —
nunca abierta directamente a internet.

## 3. Modelo de dominio

- **PesoCorporal**: `fecha`, `peso_kg`.
- **Ejercicio** (catálogo cerrado, no texto libre): `nombre`, `tipo` (`fuerza` | `cardio`). Se
  siembra inicialmente a partir de los ejercicios que ya usa la skill; ampliable por David más
  adelante (no editable por el usuario final durante el registro).
- **SesionEntrenamiento**: `fecha`, lista de `RegistroEjercicio`.
- **RegistroEjercicio** (fuerza): `ejercicio`, lista de `Serie` (`reps`, `peso_kg`, `tempo`,
  `RPE` 1-10), `notas` (texto libre opcional).
- **RegistroEjercicio** (cardio): `ejercicio`, `duracion`, `distancia_km`,
  `velocidad_media`, `ritmo_medio` (tiempo/km), `frecuencia_cardiaca_media`,
  `frecuencia_cardiaca_maxima`, `pasos`, `frecuencia_paso`, `kcal`, `RPE` (opcional),
  `notas` (texto libre opcional). Todos los campos numéricos de cardio son opcionales
  individualmente (no todos los relojes miden todo).
- Todo registro (peso o sesión) es **editable y borrable**, y puede crearse con **fecha
  retroactiva** (registro manual de un día pasado).
- Fechas almacenadas en UTC, mostradas en Europe/Madrid (CEST/CET).
- **ComentarioProgreso**: `userId` (único — un solo registro por usuario, se sobrescribe),
  `texto`, `generadoEn`. No lleva histórico: cada generación nueva reemplaza a la anterior.

## 4. Casos de uso

1. Registrar peso corporal (hoy o fecha pasada).
2. Registrar sesión de entreno con uno o varios ejercicios (fuerza y/o cardio mezclados).
3. Editar o borrar un registro existente (peso o sesión).
4. Consultar historial, filtrable por fecha y por ejercicio.
5. Consultar informe de progreso:
   - Evolución del peso corporal en el tiempo.
   - Por ejercicio de fuerza: evolución del peso máximo levantado y del volumen total
     (series × reps × peso).
   - Por ejercicio de cardio: evolución de distancia, duración y ritmo.
   - Frecuencia de entrenamiento (sesiones por semana / racha).
6. (Vía MCP) Leer y escribir estos mismos datos desde la skill "sesion-entrenamiento" o
   cualquier chat de Claude con el conector configurado.
7. Generar una propuesta de sesión con IA (botón en `/sesion`, junto al registro manual): la
   app invoca la skill "sesion-entrenamiento" con el historial real, y el resultado precarga el
   formulario de sesión — editable antes de guardar, nunca se guarda directamente.
8. Generar (o regenerar) un comentario de progreso con IA (botón en `/informe`, bajo demanda,
   nunca automático): resume la evolución reciente a partir del informe de progreso ya
   calculado. Sustituye al comentario anterior si existía.

## 5. API y contrato MCP

- El servidor MCP escucha **solo** en la interfaz de la VPN Tailscale (no expuesto a internet
  abierto) y exige además un **token secreto** (Bearer) en cada petición.
- Herramientas expuestas (nombres provisionales, a refinar en el plan de implementación):
  - `log_weight(fecha, peso_kg)`
  - `get_weight_history(desde?, hasta?)`
  - `log_session(fecha, ejercicios[])`
  - `edit_session(id, cambios)`
  - `get_session_history(desde?, hasta?, ejercicio?)`
  - `list_exercises()`
  - `get_progress_report(ejercicio?, desde?, hasta?)`
- Entrada/salida en JSON, validada contra el esquema del modelo de dominio en el servidor.
- Errores estructurados: `{ "error": { "code": "...", "message": "..." } }`.

## 6. Interfaz web (MVP)

- Login (usuario/contraseña).
- Registrar peso corporal.
- Registrar sesión de entreno (elegir ejercicio del catálogo, formulario cambia según
  fuerza/cardio, campo de notas).
- Historial (listado editable/borrable, filtrable).
- Informe de progreso (gráficos).
- `/sesion`: botón "Generar propuesta con IA", que precarga `SessionEntriesEditor` con el
  resultado (editable) sin sustituir la opción de registro manual.
- `/informe`: botón "Generar comentario de progreso", que muestra el texto generado (o el
  último guardado, si lo hay) sobre los gráficos existentes.
- Diseño mobile-first (uso principal desde el navegador del móvil).

## 7. Seguridad

- **Login web**: usuario/contraseña única (single-user), hash con bcrypt/argon2, sesión vía
  cookie httpOnly firmada. Sin registro público, sin recuperación de contraseña compleja.
- **MCP**: dos capas — solo alcanzable por la VPN Tailscale, y token Bearer secreto obligatorio
  en cada petición.
- **Validación de inputs** en el servidor para todo lo que entra (tipos, rangos: RPE 1-10,
  pesos y distancias positivos, fechas válidas), tanto desde la web como desde el MCP.
- **Secretos** (token MCP, credenciales de login, claves de backup) vía variables de
  entorno/Fly.io secrets — nunca committeados a git.
- HTTPS en todo momento (certificados de Tailscale, y de Fly.io en el despliegue inicial).
- Nuevo secreto `ANTHROPIC_API_KEY` (Fly.io secrets, nunca committeado). Límite de gasto
  mensual configurado en la consola de Anthropic.
- La skill "sesion-entrenamiento" contiene datos personales de salud de David: vive en el
  repo pero fuera de cualquier ruta servible públicamente, y su contenido nunca se loguea.
- Todo output generado por IA (propuesta de sesión, comentario de progreso) se trata como
  entrada no confiable: la propuesta de sesión pasa por la misma validación de dominio
  (`validate-session.ts`) que el registro manual antes de poder guardarse.

## 8. Persistencia

- **Turso** (libSQL, compatible con SQLite): base de datos alojada, sin fichero local en
  producción. Tablas: `users`, `body_weight`, `exercises` (catálogo), `sessions`,
  `strength_sets`, `cardio_entries`, con relaciones de sesión → registros de ejercicio →
  series (para fuerza) — el esquema no cambia respecto al SQLite original.
- Cliente Prisma vía un único adapter, `@prisma/adapter-libsql`, tanto en producción (Turso
  remoto) como en local/tests (SQLite de fichero): el mismo adapter soporta ambos modos porque
  libSQL habla el mismo protocolo de cliente en los dos casos — decisión tomada e implementada
  el 2026-07-20 (ver DECISIONS.md), en vez de mantener `@prisma/adapter-better-sqlite3` en
  paralelo solo para local. Revisado el 2026-07-20 (ver DECISIONS.md): pivote desde el Fly.io +
  SQLite con volumen originalmente planeado, tras confirmar que Fly.io ya no ofrece free tier.
- **Migraciones**: `prisma migrate dev`, `db push` y `migrate deploy` no funcionan contra
  Turso remoto (libSQL habla HTTP, incompatible con Prisma Migrate — confirmado en
  documentación oficial). Flujo: se generan localmente contra SQLite de fichero
  (`prisma migrate dev`, sin cambios ahí) y se aplican al SQL crudo con
  `scripts/apply-turso-migrations.ts` (vía `@libsql/client`, no el CLI `turso`, para no
  depender de tener ese binario instalado en el runner de CI) contra cualquier target libSQL —
  la Turso real de producción, o un `libsql-server` (imagen oficial de Turso) levantado en CI
  para verificar la migración antes de tocar producción. El script lleva su propia tabla de
  control (`_turso_migrations_applied`, no `_prisma_migrations`) para saber qué migraciones ya
  se aplicaron a cada target y ser idempotente en reintentos — ver DECISIONS.md 2026-07-20.

## 9. Observabilidad

- Solo logs (los que provee Vercel de forma gratuita en el plan Hobby). Sin alertas activas en
  el MVP — se puede añadir más adelante si hace falta (anotado en BACKLOG.md si se decide
  después).

## 10. Despliegue

- **Vercel** (plan Hobby, gratuito para uso personal/no comercial), integración nativa con
  GitHub: cada merge a `master` despliega automáticamente a producción, sin paso manual
  intermedio. Revisado el 2026-07-20 (ver DECISIONS.md): sustituye el plan original de
  Docker + Fly.io tras confirmar que Fly.io eliminó su free tier en 2024.
- Sin Docker ni volumen persistente — la persistencia vive en Turso (ver §8), no en el
  contenedor de despliegue.
- Dominio: subdominio por defecto de Vercel al principio; la URL/dominio nunca se hardcodea en
  el código (siempre vía variable de entorno), para poder cambiarlo sin fricción.
- **CI**: GitHub Actions — corre tests, typecheck y (nuevo) la verificación de migraciones
  contra `libsql-server` real (ver §8) en cada push. El despliegue en sí lo dispara
  directamente la integración Git de Vercel, no un job de GitHub Actions. Sin entorno de
  staging separado (justificado por ser un proyecto single-user).

## 11. Backup y restore

- Backup **manual bajo demanda**, no automático: un botón "Descargar backup" en `/ajustes` de
  la webapp genera al momento una copia consistente de la base de datos y la sirve como
  descarga del navegador, sin subirla a ningún almacenamiento externo ni conservar copia en el
  servidor. Al ser un único usuario, se prioriza simplicidad operativa (sin cuenta cloud
  adicional) sobre automatización.
- **Pendiente de rediseño** (ver DECISIONS.md 2026-07-20): la implementación actual usa la API
  de backup online de `better-sqlite3` leyendo el fichero local, que deja de funcionar contra
  Turso (no hay fichero local en un despliegue serverless). El mecanismo de exportación real
  contra Turso (CLI, API de plataforma, o volcado por tablas vía Prisma) se investiga como
  tarea explícita del plan de implementación, no se asume una solución todavía.
- `/ajustes` avisa si han pasado más de 30 días desde el último backup, o si nunca se ha hecho
  ninguno — red de seguridad mínima frente al olvido.
- Restore manual: importar el backup descargado en la base de datos Turso.

## 12. Fuera de alcance del MVP (backlog)

Ver [BACKLOG.md](BACKLOG.md) para detalle y justificación de cada uno:

- Integración con wearable (pasos, sueño, frecuencia cardiaca automática).
- Fotos, medidas corporales, registro de comidas.
- Login con huella/passkey (WebAuthn).
- Gamificación (logros/hitos).
- Comparativas avanzadas entre ejercicios, predicciones de 1RM, exportación de informes.
- Migración del histórico JSON existente (se decidió no migrar; la app arranca en limpio).

## 13. Criterios de aceptación del MVP

- David puede loguearse desde el navegador del móvil.
- Puede registrar su peso de hoy o de una fecha pasada.
- Puede registrar una sesión de entreno con ejercicios de fuerza y/o cardio, con las métricas
  propias de cada tipo y notas libres.
- Puede editar o borrar cualquier registro existente (peso o sesión).
- Puede consultar su historial y un informe de progreso básico con gráficos.
- La skill "sesion-entrenamiento" (u otro chat de Claude con el conector MCP configurado)
  puede leer y escribir estos datos de forma segura (VPN + token).
- La app está desplegada en Fly.io, con CI corriendo tests antes de cada cambio, y con el
  backup manual desde `/ajustes` funcionando (verificado con al menos un restore de prueba).
- Puede generar una propuesta de sesión con IA desde `/sesion`, editarla, y guardarla como
  cualquier sesión manual.
- Puede generar (o regenerar) un comentario de progreso con IA desde `/informe`.

## 14. Generación asistida por IA

Dos integraciones deliberadamente separadas y de complejidad distinta — no comparten
maquinaria para no sobre-diseñar la más simple:

1. **Propuesta de sesión**: el backend usa `@anthropic-ai/sdk` (el cliente estándar de la API
   de Mensajes, no el Claude Agent SDK — ver DECISIONS.md 2026-07-19 para por qué) y su
   `client.beta.messages.toolRunner()`, con el contenido de la skill "sesion-entrenamiento"
   (copiada en `skills/sesion-entrenamiento/`, contiene datos personales de salud de David —
   nunca debe exponerse por ninguna ruta pública ni loguearse) inyectado como `system` prompt, y
   un par de tools en proceso que envuelven las funciones de dominio ya existentes
   (`get_session_history`/`list_exercises`) para que el modelo lea historial real al decidir la
   rotación — reutilizando la lógica de la skill, sin reimplementarla en el backend. La salida
   se parsea a la misma forma que ya consume `SessionEntriesEditor` y pasa por
   `validate-session.ts` antes de poder guardarse — la salida de la IA es siempre entrada no
   confiable, igual que un formulario. Si falla (timeout ~60s, JSON inválido, red), el
   formulario cae a vacío/manual — nunca bloquea el flujo existente.
2. **Comentario de progreso**: llamada directa y simple a la API de Mensajes de Claude con
   `@anthropic-ai/sdk` (sin tools, sin toolRunner), con la salida de `get_progress_report`
   serializada como contexto. El resultado sustituye siempre al `ComentarioProgreso` anterior
   (fila única por usuario, no histórico).

**Autenticación/coste**: `ANTHROPIC_API_KEY` (pago por token, vía Fly.io secrets — nunca en
código ni logs), no autenticación por suscripción/OAuth (los términos de consumidor de
Anthropic restringen esos tokens a Claude Code/claude.ai). Coste estimado con uso diario:
~1€/mes típico, ~3-6€/mes en el peor caso — se configura un límite de gasto mensual en la
consola de Anthropic como red de seguridad adicional.
