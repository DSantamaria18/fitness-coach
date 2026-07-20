// Regla ESLint local: detecta que un módulo "use server" (Server Actions,
// Next.js App Router) importe algo exportado por un fichero "use client".
//
// Motivación (ver DECISIONS.md 2026-07-19, BACKLOG.md BL-001): RSC sustituye
// los exports de un módulo "use client" por referencias opacas al construir
// el árbol de servidor, así que llamarlos desde el servidor crashea siempre
// en runtime real ("Attempted to call X() from the server but X is on the
// client") — pero ni Vitest/jsdom ni tsc lo detectan, porque la directiva
// "use client" es una simple cadena de texto sin efecto fuera del bundler
// de RSC de Next.js. Esta regla cierra ese hueco en CI/editor.
//
// Alternativas descartadas (investigación previa, no repetir):
// - eslint-plugin-react-server-components: su única regla (use-client) solo
//   comprueba si un fichero DEBERÍA llevar "use client" por su propio
//   contenido (hooks, APIs de navegador...); no inspecciona lo que importa
//   de otros ficheros.
// - @next/eslint-plugin-next (ya en uso vía eslint-config-next): no tiene
//   ninguna regla relacionada con esto.
// - no-restricted-imports por convención de carpetas: no aplica en este
//   proyecto, donde ficheros "use server"/"use client" conviven en la misma
//   carpeta por ruta de Next.js App Router (no hay separación de directorio
//   que sirva de proxy).

import fs from "node:fs";
import path from "node:path";

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const DIRECTIVE_SERVER = "use server";
const DIRECTIVE_CLIENT = "use client";

/**
 * Comprueba si `statement` es una directiva de módulo (p. ej. "use server")
 * en el sentido del spec de JS: un ExpressionStatement cuya expresión es un
 * Literal de cadena con exactamente ese valor.
 */
function isDirectiveStatement(statement, value) {
  return (
    statement?.type === "ExpressionStatement" &&
    statement.expression?.type === "Literal" &&
    statement.expression.value === value
  );
}

function existsAsFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function existsAsDir(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/** Prueba `basePath` tal cual, luego con cada extensión soportada, luego como directorio con index.*. */
function tryResolveFile(basePath) {
  if (existsAsFile(basePath)) {
    return basePath;
  }
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (existsAsFile(candidate)) {
      return candidate;
    }
  }
  if (existsAsDir(basePath)) {
    for (const ext of RESOLVE_EXTENSIONS) {
      const candidate = path.join(basePath, `index${ext}`);
      if (existsAsFile(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** Busca el tsconfig.json más cercano subiendo desde `startDir`, devuelve su directorio o null. */
function findTsconfigDir(startDir) {
  let dir = startDir;
  for (;;) {
    if (existsAsFile(path.join(dir, "tsconfig.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * tsconfig.json es JSONC (comentarios permitidos), no JSON estricto — tsc
 * y Next.js lo toleran, y este propio proyecto tiene comentarios `//` en su
 * tsconfig.json (ver "exclude" más abajo), así que un JSON.parse directo
 * rompería la resolución del alias. Quita comentarios de línea y de bloque
 * que estén fuera de cadenas antes de parsear.
 */
function stripJsonComments(text) {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        result += char;
      }
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += char;
      if (char === "\\") {
        result += next;
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    result += char;
  }

  return result;
}

/** Lee el mapeo del alias "@/*" desde el tsconfig.json de `tsconfigDir`, resuelto a ruta absoluta. */
function readAliasBase(tsconfigDir) {
  try {
    const raw = fs.readFileSync(
      path.join(tsconfigDir, "tsconfig.json"),
      "utf8",
    );
    const json = JSON.parse(stripJsonComments(raw));
    const aliasTargets = json?.compilerOptions?.paths?.["@/*"];
    if (!Array.isArray(aliasTargets) || aliasTargets.length === 0) {
      return null;
    }
    // "./src/*" -> "./src"; los paths de tsconfig son relativos al propio
    // fichero tsconfig.json cuando no hay baseUrl (caso de este proyecto,
    // con moduleResolution "bundler").
    const target = aliasTargets[0].replace(/\/\*$/, "");
    return path.resolve(tsconfigDir, target);
  } catch {
    return null;
  }
}

/**
 * Resuelve el `importPath` de un import (relativo o alias "@/*") a un
 * fichero real en disco, tomando `fromFilename` (el fichero que importa)
 * como referencia. Devuelve null si no es resoluble como fichero del
 * proyecto (paquete de node_modules, alias sin configurar, etc.) — no es un
 * error, simplemente esta regla no tiene nada que decir sobre ello.
 */
function resolveImportToFile(fromFilename, importPath) {
  const fromDir = path.dirname(fromFilename);

  if (importPath.startsWith(".")) {
    return tryResolveFile(path.resolve(fromDir, importPath));
  }

  if (importPath.startsWith("@/")) {
    const tsconfigDir = findTsconfigDir(fromDir);
    const aliasBase = tsconfigDir && readAliasBase(tsconfigDir);
    if (!aliasBase) {
      return null;
    }
    return tryResolveFile(path.join(aliasBase, importPath.slice("@/".length)));
  }

  // Bare specifier (paquete de node_modules) u otro alias no soportado:
  // fuera del alcance de esta regla.
  return null;
}

/**
 * Lee el literal de cadena de la primera sentencia "real" (ignorando
 * comentarios y espacio en blanco iniciales) del fichero en `filePath`, si
 * la hay — es decir, su directiva de módulo en cabecera ("use client",
 * "use server", o cualquier otro literal si hubiera uno). Null si no hay
 * ninguna, o si el fichero no existe/no se puede leer. Escaneo textual
 * deliberado en vez de un parse completo: esta función solo necesita saber
 * qué cadena concreta encabeza el fichero, y evita depender de un parser
 * TS/JSX para ficheros que no son el que ESLint ya está lintando.
 */
function readLeadingDirective(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let i = 0;
  const src = source.replace(/^﻿/, "");
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src.startsWith("//", i)) {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end + 1;
      continue;
    }
    if (src.startsWith("/*", i)) {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    break;
  }

  const match = src.slice(i).match(/^(["'])((?:\\.|(?!\1).)*)\1/);
  return match ? match[2] : null;
}

// BL-016: reexports vía módulo ("export * from '...'" / "export { a, b }
// from '...'") que un barrel intermedio SIN directiva propia usa para
// reexponer algo de otro fichero. Regex sobre el contenido completo, no un
// parse completo del fichero: un barrel real solo contiene estas sentencias
// a nivel de módulo (nunca dentro de una función o bloque), así que basta
// con encontrarlas en cualquier parte del texto sin necesitar un parser
// JS/TS completo para un fichero que no es el que ESLint ya está lintando
// (ver DECISIONS.md sobre esta elección frente a usar espree/@typescript-
// eslint/parser aquí).
const MODULE_REEXPORT_PATTERN =
  /export\s*(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/g;

/** Extrae los especificadores de módulo de las sentencias de re-export de `filePath`. */
function readModuleReexportTargets(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  return Array.from(
    source.matchAll(MODULE_REEXPORT_PATTERN),
    (match) => match[1],
  );
}

/**
 * BL-016: sigue la cadena de re-exports vía módulo desde `filePath` hasta
 * encontrar un fichero con la directiva "use client" — cierra el hueco que
 * dejaba BL-001, que solo miraba la directiva del fichero al que resolvía
 * DIRECTAMENTE el import, no la de un barrel intermedio sin directiva
 * propia que a su vez reexporta de un módulo cliente. Devuelve la ruta del
 * fichero "use client" encontrado (el primero en profundidad), o null si la
 * cadena termina sin encontrar ninguno: fichero "use server" (límite
 * explícito, no sigue reexportando), fichero sin más re-exports, un
 * eslabón que no resuelve a fichero del proyecto, o un ciclo ya visitado
 * (protección vía `visited`, compartido en toda la travesía).
 */
function findTransitiveClientFile(filePath, visited) {
  if (visited.has(filePath)) {
    return null;
  }
  visited.add(filePath);

  const directive = readLeadingDirective(filePath);
  if (directive === DIRECTIVE_CLIENT) {
    return filePath;
  }
  if (directive === DIRECTIVE_SERVER) {
    return null;
  }

  for (const target of readModuleReexportTargets(filePath)) {
    const resolved = resolveImportToFile(filePath, target);
    if (!resolved) {
      continue;
    }
    const found = findTransitiveClientFile(resolved, visited);
    if (found) {
      return found;
    }
  }

  return null;
}

// La anotación JSDoc es necesaria para que TypeScript infiera "problem"
// como el tipo literal `RuleType` (y no como `string`) al importar este
// módulo .mjs desde el test .ts — sin ella, `npm run typecheck` falla en
// la llamada a `RuleTester.run` con un error de tipos.
/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Prohíbe, en un módulo "use server", importar algo exportado por un fichero "use client" — RSC no permite invocar código cliente desde el servidor. Ver DECISIONS.md 2026-07-19.',
    },
    schema: [],
    messages: {
      clientImportInServerFile:
        'No se puede importar "{{imported}}" desde "{{resolvedPath}}" (fichero "use client") en un módulo "use server". Ver DECISIONS.md 2026-07-19.',
      // BL-015: mismo problema real (RSC no permite invocar código cliente
      // desde el servidor), pero colado vía import() dinámico en vez de un
      // import estático — mensaje separado para que quien lo lea en el
      // editor/CI entienda de qué construcción viene sin tener que mirar la
      // línea reportada.
      clientDynamicImportInServerFile:
        'No se puede importar dinámicamente "{{resolvedPath}}" (fichero "use client") en un módulo "use server". Ver DECISIONS.md 2026-07-19.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const firstStatement = sourceCode.ast.body[0];

    // Solo aplica a módulos de Server Actions ("use server" como primera
    // sentencia del fichero); en cualquier otro fichero esta regla no tiene
    // nada que comprobar.
    if (!isDirectiveStatement(firstStatement, DIRECTIVE_SERVER)) {
      return {};
    }

    const filename = context.filename ?? context.getFilename();

    return {
      ImportDeclaration(node) {
        const resolvedPath = resolveImportToFile(filename, node.source.value);
        if (!resolvedPath) {
          return;
        }

        // BL-016: resolvedPath puede ser en sí mismo el fichero "use
        // client" (caso directo, BL-001) o un barrel intermedio sin
        // directiva propia que reexporta de uno — findTransitiveClientFile
        // cubre ambos, devolviendo resolvedPath tal cual en el caso
        // directo (primera comprobación de la recursión).
        const clientFile = findTransitiveClientFile(resolvedPath, new Set());
        if (!clientFile) {
          return;
        }

        const imported =
          node.specifiers
            .map((specifier) => specifier.local?.name)
            .filter(Boolean)
            .join(", ") || node.source.value;

        context.report({
          node,
          messageId: "clientImportInServerFile",
          data: {
            imported,
            resolvedPath: path.relative(process.cwd(), clientFile),
          },
        });
      },

      // BL-015: import() dinámico (`await import("./modulo")`). A
      // diferencia de ImportDeclaration, el argumento no siempre es un
      // Literal de cadena estático (puede ser una variable o un template
      // literal con interpolación) — si no podemos extraer un string
      // literal del argumento, esta regla no tiene nada que decir sobre ese
      // import, igual que ya ocurre con paquetes de node_modules.
      ImportExpression(node) {
        if (
          node.source?.type !== "Literal" ||
          typeof node.source.value !== "string"
        ) {
          return;
        }

        const resolvedPath = resolveImportToFile(filename, node.source.value);
        if (!resolvedPath) {
          return;
        }

        // BL-016: mismo criterio que el visitor ImportDeclaration de arriba.
        const clientFile = findTransitiveClientFile(resolvedPath, new Set());
        if (!clientFile) {
          return;
        }

        context.report({
          node,
          messageId: "clientDynamicImportInServerFile",
          data: {
            resolvedPath: path.relative(process.cwd(), clientFile),
          },
        });
      },
    };
  },
};

export default rule;
