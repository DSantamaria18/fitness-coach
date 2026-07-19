import { defineConfig, devices } from "@playwright/test";
import {
  ADMIN_PASSWORD_HASH,
  ADMIN_USERNAME,
  AUTH_SECRET,
  ANTHROPIC_API_KEY,
  E2E_BASE_URL,
  E2E_DATABASE_URL,
  E2E_PORT,
  MOCK_ANTHROPIC_BASE_URL,
} from "./e2e/env";

// Suite E2E de los flujos críticos de móvil (SPEC.md §2): login, registrar
// peso, registrar sesión, y las dos generaciones asistidas por IA. Vive
// aparte de Vitest (vitest.config.ts sigue cubriendo unit/componentes) —
// ver ARCHITECTURE.md, sección "Tests E2E (Playwright)".
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  // La suite es pequeña y todos los specs comparten el mismo SQLite de E2E
  // (ver global-setup.ts): un único worker evita condiciones de carrera
  // entre specs que escriben en la misma base de datos, a cambio de un
  // tiempo total de ejecución que sigue siendo asumible.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // "html" (sin abrir navegador) para poder subir el informe como artefacto
  // de CI en caso de fallo, además de "line" para logs en vivo.
  reporter: [["line"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  // Emulación de un móvil Android (viewport/UA/touch de "Pixel 7"): el uso
  // principal de la app es desde el navegador del móvil (SPEC.md §2/§6,
  // mismo criterio ya aplicado al diseño mobile-first de NavBar y los
  // formularios). Se elige un dispositivo Android en vez de un iPhone a
  // propósito: los presets "iPhone *" de Playwright emulan Safari
  // (`defaultBrowserType: "webkit"`), lo que exigiría instalar y mantener
  // también el motor WebKit; los presets Android usan Chromium, el único
  // motor que instala CI (`npx playwright install chromium`) y coherente
  // con el nombre de este proyecto.
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // `next dev` en vez de `next build && next start`: arranque más rápido
    // en cada ejecución local/CI y sigue siendo un runtime real de Next.js
    // (a diferencia de Vitest/jsdom, si interpreta "use client"/"use
    // server" — ver DECISIONS.md 2026-07-19 sobre el bug de RSC que solo
    // detecta un navegador real contra next dev/next start).
    command: `npm run dev -- -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      // Único cambio que hace posible mockear la IA sin tocar código de
      // producción: el SDK de Anthropic respeta esta variable de entorno
      // como base URL (ver DECISIONS.md 2026-07-19).
      ANTHROPIC_BASE_URL: MOCK_ANTHROPIC_BASE_URL,
      ANTHROPIC_API_KEY,
      AUTH_SECRET,
      ADMIN_USERNAME,
      ADMIN_PASSWORD_HASH,
    },
  },
});
