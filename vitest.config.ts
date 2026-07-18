import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Worktrees temporales de los agentes del equipo (viven dentro del
    // árbol del repo, gitignored, pero vitest no respeta .gitignore por
    // sí solo): sin esto, un run en la raíz vuelve a ejecutar también los
    // tests de cada worktree activo como si fueran parte de este árbol.
    exclude: [...configDefaults.exclude, ".claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
