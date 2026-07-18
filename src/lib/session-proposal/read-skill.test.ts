import { describe, expect, it } from "vitest";
import { parseSkillMarkdown, readSkillSystemPrompt } from "./read-skill";

// Fixture deliberadamente distinto del SKILL.md real (SPEC §14 punto 1: "parsing
// correcto de un fixture"), para no acoplar este test al contenido real de la
// skill, que puede cambiar.
const FIXTURE = `---
name: fixture-skill
description: >
  Descripción de prueba, no se usa en el cuerpo.
---

# Título del cuerpo

Contenido de prueba que debe sobrevivir al parseo.
`;

describe("parseSkillMarkdown", () => {
  it("separa el frontmatter YAML del cuerpo Markdown", () => {
    const body = parseSkillMarkdown(FIXTURE);

    expect(body).not.toContain("name: fixture-skill");
    expect(body).not.toContain("description:");
    expect(body).not.toMatch(/^---/);
    expect(body).toContain("# Título del cuerpo");
    expect(body).toContain(
      "Contenido de prueba que debe sobrevivir al parseo.",
    );
  });

  it("no rompe si no hay frontmatter (devuelve el texto tal cual, recortado)", () => {
    const body = parseSkillMarkdown("# Sin frontmatter\n\nTexto.");

    expect(body).toBe("# Sin frontmatter\n\nTexto.");
  });
});

describe("readSkillSystemPrompt", () => {
  it("lee skills/sesion-entrenamiento/SKILL.md del filesystem del servidor y expone solo el cuerpo", () => {
    const body = readSkillSystemPrompt();

    // Contenido real de la skill (ver skills/sesion-entrenamiento/SKILL.md):
    // el cuerpo debe estar presente...
    expect(body).toContain("# Sesión de entrenamiento — David");
    expect(body).toContain("Rotación de sesiones");
    // ...y el frontmatter (nombre/descripción usados por Claude Code para
    // descubrir la skill, no por este system prompt) no debe colarse.
    expect(body).not.toContain("name: sesion-entrenamiento");
    expect(body).not.toMatch(/^---/);
  });

  it("permite indicar una ruta de fichero alternativa (para tests/fixtures)", () => {
    // No usamos process.cwd() aquí: pasamos un fixture explícito para no
    // depender del cwd del proceso que ejecuta el test.
    expect(() =>
      readSkillSystemPrompt(`${__dirname}/does-not-exist.md`),
    ).toThrow();
  });
});
