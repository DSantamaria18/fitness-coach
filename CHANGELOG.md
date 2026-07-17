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

### Fixed

- `session.user` no incluía el `id` del usuario autenticado (faltaban los callbacks `jwt` y
  `session` en `auth.config.ts`), lo que hacía que cualquier ruta que dependiera de
  `session.user.id` tratara al usuario como no autenticado. Detectado durante la verificación
  manual de `/peso`.
