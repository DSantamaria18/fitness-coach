import path from "node:path";
import { RuleTester } from "eslint";
import rule from "./no-client-import-in-server-file.mjs";

// Contrato de la regla (ver DECISIONS.md 2026-07-19 y BACKLOG.md BL-001):
// un módulo "use server" no puede importar nada exportado por un fichero
// "use client" (RSC sustituye esos exports por referencias opacas al
// empaquetar, y la llamada crashea siempre en runtime real). Los casos de
// aquí abajo prueban el comportamiento observable de la regla (qué reporta
// y qué no), no su implementación interna.

const fixturesDir = path.join(__dirname, "__fixtures__");
const relativeDir = path.join(fixturesDir, "relative");
const aliasAppDir = path.join(fixturesDir, "alias", "app");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-client-import-in-server-file", rule, {
  valid: [
    {
      // Un módulo "use server" que importa de un fichero sin ninguna
      // directiva (server-only normal) es el caso común, no debe reportar.
      name: 'módulo "use server" importando de un fichero sin directiva',
      code: `
        "use server";
        import { helper } from "./plain-module";
        export async function action() {
          return helper();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
    },
    {
      // La regla solo se activa en ficheros "use server"; un fichero
      // "use client" importando de otro "use client" es legítimo y no le
      // concierne a esta regla en absoluto.
      name: 'módulo "use client" importando de otro "use client" (regla no aplica)',
      code: `
        "use client";
        import { helper } from "./client-module";
        export function Component() {
          return helper();
        }
      `,
      filename: path.join(relativeDir, "component.tsx"),
    },
    {
      // Un paquete externo (node_modules) no debe intentar resolverse
      // como fichero del proyecto ni hacer fallar la regla.
      name: 'módulo "use server" importando un paquete externo',
      code: `
        "use server";
        import { z } from "zod";
        export async function action() {
          return z.string();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
    },
    {
      // BL-015: import() dinámico (ImportExpression) hacia un fichero sin
      // directiva — mismo caso "sano" que el ImportDeclaration equivalente.
      name: 'módulo "use server" con import() dinámico de un fichero sin directiva',
      code: `
        "use server";
        export async function action() {
          const { helper } = await import("./plain-module");
          return helper();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
    },
    {
      // BL-015: el argumento de import() no siempre es un Literal estático
      // (puede ser una variable, una template literal con interpolación,
      // etc.) — un import dinámico genuino. La regla no tiene forma de saber
      // a qué fichero resuelve, así que no debe reportar ni petar.
      name: 'módulo "use server" con import() dinámico no-literal (variable)',
      code: `
        "use server";
        export async function action(moduleName) {
          const mod = await import(moduleName);
          return mod.helper();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
    },
  ],
  invalid: [
    {
      // Caso exacto del bug real: Server Action importando (ruta relativa)
      // de un fichero "use client".
      name: 'módulo "use server" importando (relativo) de un fichero "use client"',
      code: `
        "use server";
        import { helper } from "./client-module";
        export async function action() {
          return helper();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
      errors: [{ messageId: "clientImportInServerFile" }],
    },
    {
      // Mismo caso, pero resolviendo el import vía el alias "@/*" en vez
      // de una ruta relativa — confirma que la resolución del alias
      // definido en tsconfig.json también se detecta.
      name: 'módulo "use server" importando (alias "@/*") de un fichero "use client"',
      code: `
        "use server";
        import { clientThing } from "@/lib/client-thing";
        export async function action() {
          return clientThing();
        }
      `,
      filename: path.join(aliasAppDir, "action.ts"),
      errors: [{ messageId: "clientImportInServerFile" }],
    },
    {
      // BL-015: mismo bug real que BL-001, pero colado vía import() dinámico
      // (ruta relativa) en vez de un import estático — la brecha de
      // cobertura que motiva esta ampliación.
      name: 'módulo "use server" con import() dinámico (relativo) de un fichero "use client"',
      code: `
        "use server";
        export async function action() {
          const { helper } = await import("./client-module");
          return helper();
        }
      `,
      filename: path.join(relativeDir, "action.ts"),
      errors: [{ messageId: "clientDynamicImportInServerFile" }],
    },
    {
      // Mismo caso vía alias "@/*", reutilizando los fixtures de alias ya
      // existentes.
      name: 'módulo "use server" con import() dinámico (alias "@/*") de un fichero "use client"',
      code: `
        "use server";
        export async function action() {
          const clientThing = await import("@/lib/client-thing");
          return clientThing.clientThing();
        }
      `,
      filename: path.join(aliasAppDir, "action.ts"),
      errors: [{ messageId: "clientDynamicImportInServerFile" }],
    },
  ],
});
