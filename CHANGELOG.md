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
