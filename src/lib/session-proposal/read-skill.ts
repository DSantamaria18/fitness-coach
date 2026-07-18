import { readFileSync } from "node:fs";
import { join } from "node:path";

// La skill contiene datos personales de salud de David (SPEC §7 / CLAUDE.md
// de este encargo): este módulo es el único punto que lee su contenido, y
// solo expone el cuerpo Markdown para usarlo como `system` prompt de una
// llamada server-side a la API de Mensajes — nunca se sirve crudo desde
// ningún endpoint ni Server Action, y no se loguea en ningún punto.
const DEFAULT_SKILL_PATH = join(
  process.cwd(),
  "skills",
  "sesion-entrenamiento",
  "SKILL.md",
);

// El frontmatter YAML (delimitado por "---" al inicio) es metadata para que
// Claude Code descubra la skill (name/description); el cuerpo Markdown es lo
// único relevante como instrucciones de generación, así que se separan.
const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function parseSkillMarkdown(raw: string): string {
  return raw.replace(FRONTMATTER_BLOCK, "").trim();
}

export function readSkillSystemPrompt(
  filePath: string = DEFAULT_SKILL_PATH,
): string {
  const raw = readFileSync(filePath, "utf-8");
  return parseSkillMarkdown(raw);
}
