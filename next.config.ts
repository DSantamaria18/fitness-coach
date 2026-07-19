import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La suite E2E (Playwright, ver playwright.config.ts) navega contra
  // 127.0.0.1 en vez de localhost: sin este origen en la lista, Next 16
  // bloquea el WebSocket de HMR de "next dev" con un warning en consola.
  // Es solo dev (Fast Refresh), no afecta al build de producción.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
