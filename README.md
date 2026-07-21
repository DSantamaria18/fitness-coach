# Fitness Coach

Webapp personal de seguimiento de fitness para uso individual (David). Sirve como fuente de
verdad del historial de entrenamiento (peso corporal, series, reps, tempo, RPE por ejercicio),
sustituyendo al archivo JSON local que hoy usa la skill de Claude "sesion-entrenamiento". La
app debe poder conectarse a la cuenta de Claude del usuario para que esa skill (u otros chats)
lean y escriban datos directamente.

> Estado: MVP en curso (iteración 1). Ya implementados: login, registro de peso corporal,
> historial de peso (con edición/borrado), registro de sesiones de entreno y un conector MCP
> para la skill "sesion-entrenamiento". Ver [FEATURES.md](FEATURES.md) para el detalle y
> [BACKLOG.md](BACKLOG.md) para lo pendiente.

## Ejecución en local

Requisitos: Node.js 20+ y npm.

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea tu fichero de entorno a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

   Rellena en `.env`:
   - `AUTH_SECRET` — genera uno con `npx auth secret`.
   - `ADMIN_USERNAME` — el usuario con el que iniciarás sesión (único usuario de la app).
   - `ADMIN_PASSWORD_HASH` — genera el hash con `npm run hash-password -- "tu-password"`
     (nunca guardes la contraseña en claro).
   - `ANTHROPIC_API_KEY` — opcional en local; solo hace falta para probar las funciones de IA
     (propuesta de sesión en `/sesion` y comentario de progreso en `/informe`). Es una clave de
     pago de [console.anthropic.com](https://console.anthropic.com), separada de una suscripción
     de Claude.ai.

   `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` no hacen falta en local: solo se usan en producción
   (ver `.env.example` y ARCHITECTURE.md, "Persistencia") — en local/tests el cliente Prisma usa
   `DATABASE_URL` (fichero SQLite normal).

3. Aplica las migraciones y siembra el usuario administrador:

   ```bash
   npx prisma migrate deploy
   npm run prisma:generate
   npm run prisma:seed
   ```

   `prisma:seed` crea el único usuario de la app en la base de datos SQLite local a partir de
   `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` — sin este paso el login falla aunque el `.env` esté
   bien configurado.

4. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La app queda disponible en [http://localhost:3000](http://localhost:3000).

Otros comandos útiles durante el desarrollo:

```bash
npm run test         # tests unitarios y de componentes (Vitest)
npm run test:e2e     # tests E2E de los flujos críticos de móvil (Playwright)
npm run typecheck    # comprobación de tipos (tsc --noEmit)
npm run lint         # ESLint
npm run format       # Prettier (aplica formato)
```

`npm run test:e2e` no necesita nada de lo anterior configurado a mano: levanta su propio
servidor (`next dev` en el puerto 3100), su propia base de datos SQLite de usar y tirar
(migrada y sembrada automáticamente) y un servidor local que sustituye a la API de Anthropic —
nunca gasta una llamada real, ni siquiera en los flujos de IA (`/sesion`, `/informe`). Ver
[ARCHITECTURE.md](ARCHITECTURE.md), sección "Tests E2E (Playwright)".

## Conector MCP

La app expone un servidor [MCP](https://modelcontextprotocol.io) en `POST /api/mcp` para que la
skill de Claude "sesion-entrenamiento" (u otro chat con el conector configurado) pueda leer y
escribir el historial de entreno directamente, en vez de depender de un archivo JSON local.
Requiere configurar la variable de entorno `MCP_BEARER_TOKEN` (ver `.env.example`) antes de
usarlo — sin ella, el endpoint no autentica ninguna petición.

### Conectar Claude Code al servidor MCP desplegado

Desde cualquier directorio (`--scope user` lo deja disponible en cualquier proyecto, no solo en
este repo):

```bash
claude mcp add --scope user --transport http --header "Authorization: Bearer <token>" fitness-coach https://<tu-url-de-produccion>/api/mcp
```

- `<token>` es el mismo valor que `MCP_BEARER_TOKEN` en producción. No lo compartas en texto
  plano innecesariamente (chats, tickets, capturas de pantalla) más allá de lo imprescindible
  para configurar el conector.
- `<tu-url-de-produccion>` es la URL pública del despliegue (Vercel).

Para comprobar que la conexión funciona:

```bash
claude mcp list
```

o, dentro de una sesión de Claude Code, con el comando `/mcp` — ambos deben mostrar
`fitness-coach` como conector activo con sus 7 tools (`log_weight`, `get_weight_history`,
`log_session`, `edit_session`, `get_session_history`, `list_exercises`,
`get_progress_report`). Sin este conector conectado, la skill "sesion-entrenamiento" avisa
explícitamente del problema y no genera ninguna sesión — no hay fallback a ningún archivo
local (ver DECISIONS.md 2026-07-21).

## Ampliar el catálogo de ejercicios en producción

El catálogo de ejercicios (`prisma/seed.ts`) se siembra con `upsert` por nombre: crea o
actualiza, **nunca borra**. Para ampliarlo en la base de datos de producción (Turso) sin teclear
credenciales sensibles a mano, hay un workflow de GitHub Actions de disparo manual
(`.github/workflows/seed-prod.yml`).

Configuración previa (una sola vez, por David, nunca se pegan valores en un chat — el runner los
inyecta solo en su entorno aislado):

```bash
gh secret set TURSO_DATABASE_URL
gh secret set TURSO_AUTH_TOKEN
```

Para lanzar el seed contra producción a partir de ahí:

```bash
gh workflow run seed-prod.yml
```

Flujo: para añadir ejercicios nuevos, se editan en `prisma/seed.ts`, se mergea a `master`, y se
dispara el workflow. El workflow está restringido **a propósito** a scripts idempotentes/no
destructivos (`upsert`): nunca debe usarse para migraciones destructivas ni borrados (ver
[DECISIONS.md](DECISIONS.md)).

## Alcance por iteraciones

- **Iteración 1 (MVP, en curso):** registro de peso corporal y de sesiones de entreno
  (ejercicio, series, reps, tempo, peso, RPE), con conexión hacia la cuenta de Claude del
  usuario.
- **Iteración 2 (futura):** integración con datos de pulsera/wearable (pasos, sueño,
  frecuencia cardiaca).
- **Iteración 3 (futura):** fotos, medidas corporales, registro de comidas.

## Documentación del proyecto

- [BACKLOG.md](BACKLOG.md) — features/defectos pendientes y propuestas de mejora.
- [CHANGELOG.md](CHANGELOG.md) — cambios por versión.
- [FEATURES.md](FEATURES.md) — funcionalidades ya implementadas.
- [DECISIONS.md](DECISIONS.md) — decisiones de diseño/arquitectura y lecciones aprendidas.
- [ARCHITECTURE.md](ARCHITECTURE.md) — arquitectura de la aplicación.
