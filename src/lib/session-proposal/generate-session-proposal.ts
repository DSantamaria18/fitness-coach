import Anthropic from "@anthropic-ai/sdk";
import { validateSession, type ValidatedSession } from "@/lib/validate-session";
import { readSkillSystemPrompt } from "./read-skill";
import {
  createGetSessionHistoryTool,
  createListExercisesTool,
  createSubmitSessionProposalTool,
  SUBMIT_SESSION_PROPOSAL_TOOL_NAME,
} from "./tools";

// Sonnet 5: buen equilibrio razonamiento/uso de tools/coste para esta tarea.
// La estimación de coste dada a David (~1-6€/mes con uso diario, ver
// DECISIONS.md 2026-07-18) se calculó con precios de Sonnet 5/Haiku 4.5, no
// de Opus — que además se dispara aquí al hacer varias llamadas por turno de
// exploración del toolRunner (hasta MAX_EXPLORATION_ITERATIONS).
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 30_000;
// Límite de turnos de exploración (lectura de historial/catálogo) antes de
// pasar a la fase de salida forzada — evita un bucle sin fin si el modelo no
// converge, incluso dentro del presupuesto de tiempo.
const MAX_EXPLORATION_ITERATIONS = 6;

const FORMAT_INSTRUCTIONS = `
Cuando ya tengas suficiente información del historial y del catálogo para decidir la sesión
de hoy, deja de usar herramientas de consulta y resume en un par de frases qué sesión toca y
por qué. Todavía no generes la salida estructurada: se te pedirá formalizarla en el siguiente
turno con la herramienta submit_session_proposal.
`.trim();

const FINAL_TURN_PROMPT =
  "Formaliza ahora la propuesta con la herramienta submit_session_proposal.";

export type SessionProposalError = {
  code: "TIMEOUT" | "API_ERROR" | "NO_PROPOSAL" | "INVALID_OUTPUT";
  message: string;
};

export type SessionProposalResult =
  | { success: true; data: ValidatedSession }
  | { success: false; error: SessionProposalError };

export type GenerateSessionProposalOptions = {
  timeoutMs?: number;
};

function isSubmitProposalBlock(
  block: Anthropic.Beta.BetaContentBlock,
): block is Anthropic.Beta.BetaToolUseBlock {
  return (
    block.type === "tool_use" &&
    block.name === SUBMIT_SESSION_PROPOSAL_TOOL_NAME
  );
}

// Orquesta la propuesta de sesión con IA (SPEC §14 punto 1): fase 1 deja
// explorar libremente el historial/catálogo con el toolRunner (tool_choice
// "auto", el comportamiento por defecto); fase 2 es una única llamada
// adicional, con la conversación acumulada de la fase 1, que fuerza
// `tool_choice` al tool de salida — así el "turno final" que exige el
// contrato de esta feature es literal, no una promesa del prompt. userId
// nunca sale de este argumento (viene siempre de la sesión autenticada del
// caller, ver Server Action) y se cierra sobre el closure de cada tool de
// solo lectura — jamás es algo que el modelo pueda rellenar.
export async function generateSessionProposal(
  userId: string,
  options: GenerateSessionProposalOptions = {},
): Promise<SessionProposalResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = new Anthropic();
    const system = `${readSkillSystemPrompt()}\n\n${FORMAT_INSTRUCTIONS}`;

    const explorationRunner = client.beta.messages.toolRunner(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [createGetSessionHistoryTool(userId), createListExercisesTool()],
        messages: [
          {
            role: "user",
            content: "Genera la propuesta de sesión de entreno de hoy.",
          },
        ],
        max_iterations: MAX_EXPLORATION_ITERATIONS,
      },
      { signal: controller.signal },
    );

    await explorationRunner.runUntilDone();
    const exploredMessages = explorationRunner.params.messages;

    const finalResponse = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [createSubmitSessionProposalTool()],
        tool_choice: { type: "tool", name: SUBMIT_SESSION_PROPOSAL_TOOL_NAME },
        messages: [
          ...exploredMessages,
          { role: "user", content: FINAL_TURN_PROMPT },
        ],
      },
      { signal: controller.signal },
    );

    const proposalBlock = finalResponse.content.find(isSubmitProposalBlock);
    if (!proposalBlock) {
      return {
        success: false,
        error: {
          code: "NO_PROPOSAL",
          message: "El modelo no devolvió una propuesta estructurada.",
        },
      };
    }

    // La salida de la IA es siempre entrada no confiable (SPEC §7): pasa por
    // la misma validación que el registro manual antes de poder usarse.
    const validation = validateSession(proposalBlock.input);
    if (!validation.success) {
      return {
        success: false,
        error: {
          code: "INVALID_OUTPUT",
          message: "La propuesta generada no tiene un formato válido.",
        },
      };
    }

    return { success: true, data: validation.data };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        success: false,
        error: { code: "TIMEOUT", message: "La generación tardó demasiado." },
      };
    }
    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: error instanceof Error ? error.message : "Error desconocido.",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
