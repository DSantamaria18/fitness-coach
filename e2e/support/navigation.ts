import type { Page } from "@playwright/test";

// Next.js (App Router, componentes "use client") necesita que el bundle
// del cliente termine de hidratarse antes de que los manejadores onClick/
// onChange respondan a una interacción — las comprobaciones de
// "actionability" de Playwright (visible/habilitado/estable) no esperan a
// la hidratación en sí, así que un click/select justo después de goto()
// puede no hacer nada (se detectó así: un test seleccionaba un ejercicio y
// pulsaba "Añadir" antes de que el <select> estuviera hidratado, y el
// registro añadido usaba el estado inicial de React en vez del valor
// seleccionado). Esperar a "networkidle" tras cada navegación es seguro
// aquí porque el WebSocket de HMR de "next dev" no se queda abierto
// indefinidamente: Next 16 lo bloquea por origen salvo que esté en
// `allowedDevOrigins` (ver next.config.ts), así que la red sí llega a
// quedar inactiva en vez de no resolver nunca.
export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}
