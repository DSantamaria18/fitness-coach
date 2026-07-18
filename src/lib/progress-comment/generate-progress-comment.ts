import Anthropic from "@anthropic-ai/sdk";
import type { ProgressReportData } from "@/lib/get-progress-report";

export type GenerateProgressCommentResult =
  | { success: true; texto: string }
  | { success: false; error: string };

// Modelo fijo (no configurable): esta es la integración de IA "simple" del
// proyecto (SPEC.md §14 punto 2, DECISIONS.md 2026-07-19) — una única
// llamada de texto, sin necesidad de elegir modelo por caso de uso.
const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Eres el asistente de fitness personal de David. Se te da su informe de progreso en formato JSON: evolución de peso corporal, frecuencia/racha de entrenamiento y, si se indica, progreso de un ejercicio concreto (peso máximo, volumen, distancia, ritmo...).

Escribe un comentario breve (2-4 frases), en español, cercano y motivador, que destaque las tendencias más relevantes del informe (mejoras, estancamientos, constancia). Básate únicamente en los datos del informe — no inventes cifras ni ejercicios que no aparezcan en él. No uses markdown ni listas, solo texto corrido.`;

// Llamada directa y simple a la API de Mensajes (client.messages.create),
// deliberadamente SIN tools ni toolRunner — a diferencia de la propuesta de
// sesión, que sí los usa (ver SPEC.md §14 y DECISIONS.md 2026-07-19: las dos
// integraciones de IA del proyecto tienen complejidad distinta a propósito,
// para no sobre-diseñar la más simple). El informe ya calculado por
// getProgressReport se serializa como contexto de la llamada.
//
// Nunca lanza: cualquier fallo (red, rate limit, respuesta vacía) se
// traduce en `{success: false}` para que quien llama (la Server Action de
// /informe) pueda mostrar un aviso discreto sin romper la página.
export async function generateProgressComment(
  reportData: ProgressReportData,
): Promise<GenerateProgressCommentResult> {
  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(reportData),
        },
      ],
    });
  } catch {
    return {
      success: false,
      error: "No se ha podido generar el comentario de progreso.",
    };
  }

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );

  if (!textBlock || textBlock.text.trim().length === 0) {
    return {
      success: false,
      error: "No se ha podido generar el comentario de progreso.",
    };
  }

  return { success: true, texto: textBlock.text.trim() };
}
