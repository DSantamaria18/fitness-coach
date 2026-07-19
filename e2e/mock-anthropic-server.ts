import http from "node:http";

// Sustituye a api.anthropic.com durante los tests E2E (arrancado desde
// global-setup.ts, apuntado vía ANTHROPIC_BASE_URL — ver e2e/env.ts y
// DECISIONS.md 2026-07-19 para el porqué de este enfoque frente a
// `page.route()`, que no intercepta tráfico servidor-a-servidor).
//
// Detalles del contrato mockeado que sí importan porque el código de
// producción se comporta distinto según ellos: el path es literalmente
// /v1/messages tanto para client.messages.create como para
// client.beta.messages.create (la beta solo añade ?beta=true a la query
// string — confirmado en @anthropic-ai/sdk/resources/*/messages*.js), así
// que un único handler cubre las dos integraciones de IA de la app.

export const SUBMIT_SESSION_PROPOSAL_TOOL_NAME = "submit_session_proposal";

// "Sentadilla" es un ejercicio de fuerza sembrado por prisma/seed.ts: la
// propuesta mockeada debe referenciar un ejercicio real del catálogo para
// que pase la validación de existencia de create-session.ts si el test
// llegara a guardarla (aunque hoy el spec de la propuesta con IA solo
// verifica la precarga del formulario, no el guardado).
export const MOCK_SESSION_PROPOSAL = {
  ejercicio: "Sentadilla",
  reps: 5,
  pesoKg: 60,
  rpe: 7,
} as const;

export const MOCK_PROGRESS_COMMENT_TEXT =
  "Comentario de progreso generado por el mock de Anthropic para el entorno E2E.";

type MockMessageRequestBody = {
  model?: string;
  tools?: unknown[];
  tool_choice?: { type?: string; name?: string };
};

function buildTextMessage(text: string, model: string) {
  return {
    id: `msg_mock_${Math.random().toString(36).slice(2)}`,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

// Solo se usa para el turno final forzado de la propuesta de sesión
// (tool_choice: {type: "tool", name: submit_session_proposal}): el `input`
// debe cumplir sessionSchema (validate-session.ts) porque
// generateSessionProposal lo valida de verdad con Zod antes de aceptarlo,
// igual que haría con una respuesta real del modelo.
function buildSubmitProposalMessage(model: string) {
  return {
    id: `msg_mock_${Math.random().toString(36).slice(2)}`,
    type: "message",
    role: "assistant",
    model,
    content: [
      {
        type: "tool_use",
        id: "toolu_mock_1",
        name: SUBMIT_SESSION_PROPOSAL_TOOL_NAME,
        input: {
          fecha: new Date().toISOString(),
          ejercicios: [
            {
              tipo: "fuerza",
              ejercicio: MOCK_SESSION_PROPOSAL.ejercicio,
              series: [
                {
                  reps: MOCK_SESSION_PROPOSAL.reps,
                  peso_kg: MOCK_SESSION_PROPOSAL.pesoKg,
                  tempo: "2010",
                  RPE: MOCK_SESSION_PROPOSAL.rpe,
                },
              ],
              notas: "Propuesta generada por el mock de Anthropic (E2E).",
            },
          ],
        },
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

async function readJsonBody(
  req: http.IncomingMessage,
): Promise<MockMessageRequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

export type MockAnthropicServer = { close: () => Promise<void> };

export function startMockAnthropicServer(
  port: number,
): Promise<MockAnthropicServer> {
  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (req.method !== "POST" || url.pathname !== "/v1/messages") {
        res.writeHead(404, { "content-type": "application/json" }).end(
          JSON.stringify({
            error: { type: "not_found_error", message: "unmocked route" },
          }),
        );
        return;
      }

      let body: MockMessageRequestBody;
      try {
        body = await readJsonBody(req);
      } catch {
        res.writeHead(400, { "content-type": "application/json" }).end(
          JSON.stringify({
            error: { type: "invalid_request_error", message: "invalid JSON" },
          }),
        );
        return;
      }

      const model = typeof body.model === "string" ? body.model : "mock-model";

      // Fase 2 de generate-session-proposal.ts: única llamada que fija
      // tool_choice a submit_session_proposal — el resto (fase 1 de
      // exploración con tool_choice "auto" por defecto, y la llamada única
      // sin tools de generateProgressComment) responde solo con texto.
      const forcesSubmitProposal =
        body.tool_choice?.type === "tool" &&
        body.tool_choice?.name === SUBMIT_SESSION_PROPOSAL_TOOL_NAME;

      const responseBody = forcesSubmitProposal
        ? buildSubmitProposalMessage(model)
        : buildTextMessage(
            Array.isArray(body.tools) && body.tools.length > 0
              ? "He revisado el historial y el catálogo, ya puedo formalizar la propuesta."
              : MOCK_PROGRESS_COMMENT_TEXT,
            model,
          );

      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(responseBody));
    })();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve({
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
