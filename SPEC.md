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

## 8. Persistencia

- **SQLite**, un único fichero. Tablas: `users`, `body_weight`, `exercises` (catálogo),
  `sessions`, `strength_sets`, `cardio_entries`, con relaciones de sesión → registros de
  ejercicio → series (para fuerza).
- Migraciones versionadas gestionadas por el ORM/librería que se elija en el plan de
  implementación.

## 9. Observabilidad

- Solo logs (los que provee Fly.io de forma gratuita). Sin alertas activas en el MVP — se
  puede añadir más adelante si hace falta (anotado en BACKLOG.md si se decide después).

## 10. Despliegue

- Empaquetado en **Docker estándar**, sin dependencias específicas de Fly.io más allá del
  volumen persistente para el fichero SQLite — para poder migrar sin fricción.
- Despliegue inicial en **Fly.io** (free tier). Migración futura al NAS/servidor propio de
  David cuando esté montado, documentada como paso explícito en DECISIONS.md llegado el
  momento (config de despliegue rehecha, fichero SQLite copiado desde backup).
- Dominio: subdominio por defecto de Fly.io al principio; la URL/dominio nunca se hardcodea en
  el código (siempre vía variable de entorno), para poder cambiarlo sin fricción.
- **CI**: GitHub Actions — corre tests y typecheck en cada push. Sin entorno de staging
  separado (justificado por ser un proyecto single-user).

## 11. Backup y restore

- Copia diaria del fichero SQLite mediante el comando `.backup` de SQLite (seguro con
  escrituras concurrentes), subida a almacenamiento externo barato/gratuito (a concretar en el
  plan de implementación: Backblaze B2, S3 free tier, o similar).
- Restore manual: sustituir el fichero del volumen por el backup elegido.

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
- La app está desplegada en Fly.io, con CI corriendo tests antes de cada cambio, y con backups
  diarios automáticos funcionando (verificados con al menos un restore de prueba).
