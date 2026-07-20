import { describe, expect, it, vi, beforeEach } from "vitest";

// Se mockea el cliente @anthropic-ai/sdk por completo: nunca una llamada
// real a la API en tests/CI (cuesta dinero real y sería no determinista,
// ver encargo del Tech Lead / SPEC §14).
const toolRunnerMock = vi.fn();
const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  // `mockImplementation` debe recibir una función normal, no una arrow
  // function: el propio SDK usa `new Anthropic()`, y una arrow function no
  // es invocable como constructor (TypeError: ... is not a constructor).
  return {
    default: vi.fn().mockImplementation(function AnthropicMock() {
      return {
        beta: {
          messages: {
            toolRunner: toolRunnerMock,
            create: createMock,
          },
        },
      };
    }),
  };
});

vi.mock("./read-skill", () => ({
  readSkillSystemPrompt: vi.fn().mockReturnValue("Contenido de la skill."),
}));

import { generateSessionProposal } from "./generate-session-proposal";
import { SUBMIT_SESSION_PROPOSAL_TOOL_NAME } from "./tools";

const VALID_PROPOSAL_INPUT = {
  fecha: "2026-01-01T00:00:00.000Z",
  ejercicios: [
    {
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      series: [{ reps: 10, peso_kg: 10, RPE: 7 }],
    },
  ],
};

function fakeExplorationRunner(messages: unknown[] = []) {
  return {
    runUntilDone: vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "Listo para proponer." }],
    }),
    params: { messages },
  };
}

function fakeFinalResponse(toolInput: unknown) {
  return {
    content: [
      {
        type: "tool_use",
        id: "toolu_1",
        name: SUBMIT_SESSION_PROPOSAL_TOOL_NAME,
        input: toolInput,
      },
    ],
  };
}

describe("generateSessionProposal", () => {
  beforeEach(() => {
    toolRunnerMock.mockReset();
    createMock.mockReset();
  });

  it("éxito: extrae el input de submit_session_proposal y lo valida con validateSession", async () => {
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue(fakeFinalResponse(VALID_PROPOSAL_INPUT));

    const result = await generateSessionProposal("user-1");

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        fecha: VALID_PROPOSAL_INPUT.fecha,
        ejercicios: expect.arrayContaining([
          expect.objectContaining({ ejercicio: "Sentadilla" }),
        ]),
      }),
    });
  });

  it("fuerza tool_choice al tool de salida en el turno final", async () => {
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue(fakeFinalResponse(VALID_PROPOSAL_INPUT));

    await generateSessionProposal("user-1");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: "tool", name: SUBMIT_SESSION_PROPOSAL_TOOL_NAME },
      }),
      expect.anything(),
    );
  });

  it("rechaza como fallo cuando el tool de salida devuelve datos que no pasan validateSession", async () => {
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue(
      fakeFinalResponse({
        fecha: "2026-01-01T00:00:00.000Z",
        ejercicios: [], // min(1) en sessionSchema: array vacío no es válido
      }),
    );

    const result = await generateSessionProposal("user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_OUTPUT");
    }
  });

  // Este es el fallo más opaco hoy (SPEC: el modelo respondió, pero con una
  // forma que no encaja con sessionSchema) — verificamos que quede constancia
  // en los logs de Vercel identificable por code, sin acoplarnos al string
  // exacto del mensaje ni a los detalles internos de cómo se logea.
  it("loguea el fallo con el code INVALID_OUTPUT cuando la salida no pasa validateSession", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue(
      fakeFinalResponse({
        fecha: "2026-01-01T00:00:00.000Z",
        ejercicios: [],
      }),
    );

    await generateSessionProposal("user-1");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: "INVALID_OUTPUT" }),
    );
    consoleErrorSpy.mockRestore();
  });

  it("rechaza como fallo cuando el turno final no contiene ningún tool_use de submit_session_proposal", async () => {
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "No puedo generar la propuesta." }],
    });

    const result = await generateSessionProposal("user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NO_PROPOSAL");
    }
  });

  it("loguea el fallo con el code NO_PROPOSAL cuando el turno final no contiene submit_session_proposal", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "No puedo generar la propuesta." }],
    });

    await generateSessionProposal("user-1");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: "NO_PROPOSAL" }),
    );
    consoleErrorSpy.mockRestore();
  });

  it("trata el timeout como fallo (nunca lanza) cuando la generación excede el límite", async () => {
    // Simula una llamada real que respeta el AbortSignal pasado al SDK: no
    // resuelve hasta que se aborta, igual que haría una petición HTTP real.
    toolRunnerMock.mockReturnValue({
      runUntilDone: vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            const lastCallArgs = toolRunnerMock.mock.calls.at(-1);
            const signal = lastCallArgs?.[1]?.signal as AbortSignal | undefined;
            signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
      params: { messages: [] },
    });

    const result = await generateSessionProposal("user-1", { timeoutMs: 5 });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "TIMEOUT" }),
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("loguea el fallo con el code TIMEOUT cuando se aborta la generación", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    toolRunnerMock.mockReturnValue({
      runUntilDone: vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            const lastCallArgs = toolRunnerMock.mock.calls.at(-1);
            const signal = lastCallArgs?.[1]?.signal as AbortSignal | undefined;
            signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
      params: { messages: [] },
    });

    await generateSessionProposal("user-1", { timeoutMs: 5 });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: "TIMEOUT" }),
    );
    consoleErrorSpy.mockRestore();
  });

  it("trata un error de red/API como fallo (nunca lanza)", async () => {
    toolRunnerMock.mockReturnValue({
      runUntilDone: vi.fn().mockRejectedValue(new Error("network down")),
      params: { messages: [] },
    });

    const result = await generateSessionProposal("user-1");

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "API_ERROR" }),
    });
  });

  it("loguea el fallo con el code API_ERROR cuando hay un error de red/API", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    toolRunnerMock.mockReturnValue({
      runUntilDone: vi.fn().mockRejectedValue(new Error("network down")),
      params: { messages: [] },
    });

    await generateSessionProposal("user-1");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: "API_ERROR" }),
    );
    consoleErrorSpy.mockRestore();
  });

  it("nunca lanza una excepción, incluso ante un fallo inesperado en la fase final", async () => {
    toolRunnerMock.mockReturnValue(fakeExplorationRunner());
    createMock.mockRejectedValue(new Error("boom"));

    await expect(generateSessionProposal("user-1")).resolves.toMatchObject({
      success: false,
    });
  });
});
