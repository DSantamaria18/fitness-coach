import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código generado por Prisma, no se lintea.
    "src/generated/**",
    // Worktrees temporales de los agentes del equipo (viven dentro del
    // árbol del repo, gitignored, pero eslint no respeta .gitignore por
    // sí solo): sin esto, un run en la raíz relinta también el código de
    // cada worktree activo como si fuera parte de este árbol.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
