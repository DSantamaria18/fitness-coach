import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import noClientImportInServerFile from "./eslint-rules/no-client-import-in-server-file.mjs";

// Plugin ESLint local (sin publicar), solo para reglas propias del
// proyecto. Ver eslint-rules/no-client-import-in-server-file.mjs y
// ARCHITECTURE.md para el porqué de una regla custom en vez de una regla
// existente del ecosistema.
const localRules = {
  meta: { name: "local" },
  rules: {
    "no-client-import-in-server-file": noClientImportInServerFile,
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  {
    plugins: { local: localRules },
    rules: {
      "local/no-client-import-in-server-file": "error",
    },
  },
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
    // Fixtures de eslint-rules/*.test.ts: ficheros deliberadamente
    // mínimos usados solo vía RuleTester (nunca importados por la app),
    // no deben lintearse como código de producto.
    "eslint-rules/__fixtures__/**",
  ]),
]);

export default eslintConfig;
