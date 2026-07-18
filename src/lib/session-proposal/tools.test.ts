import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/get-session-history", () => ({
  getSessionHistory: vi.fn(),
}));
vi.mock("@/lib/list-exercises", () => ({
  listExercises: vi.fn(),
}));

import { getSessionHistory } from "@/lib/get-session-history";
import { listExercises } from "@/lib/list-exercises";
import {
  createGetSessionHistoryTool,
  createListExercisesTool,
  createSubmitSessionProposalTool,
  SUBMIT_SESSION_PROPOSAL_TOOL_NAME,
} from "./tools";

const getSessionHistoryMock = vi.mocked(getSessionHistory);
const listExercisesMock = vi.mocked(listExercises);

describe("createGetSessionHistoryTool", () => {
  beforeEach(() => {
    getSessionHistoryMock.mockReset();
  });

  it("llama a getSessionHistory con el userId cerrado sobre el closure y los filtros del modelo", async () => {
    getSessionHistoryMock.mockResolvedValue({ success: true, data: [] });
    const tool = createGetSessionHistoryTool("user-1");

    await tool.run({
      desde: "2026-01-01T00:00:00.000Z",
      ejercicio: "Sentadilla",
    });

    expect(getSessionHistoryMock).toHaveBeenCalledWith("user-1", {
      desde: "2026-01-01T00:00:00.000Z",
      ejercicio: "Sentadilla",
    });
  });

  // Test de seguridad (mismo rigor que resolve-user.test.ts): el userId
  // jamás sale del input que controla el modelo, ni siquiera si el "modelo"
  // (una respuesta de tool_use maliciosa o simplemente alucinada) intenta
  // colar uno distinto en el input del tool. Se pasa por `tool.parse()` antes
  // de `tool.run()` (igual que hace `runRunnableTool` del SDK en producción,
  // ver node_modules/@anthropic-ai/sdk/.../BetaRunnableTool.ts): el
  // input_schema de Zod no declara `userId`, así que se descarta al parsear,
  // y aunque no se descartara, `run()` nunca lee ese campo — usa siempre el
  // argumento explícito de `createGetSessionHistoryTool`.
  it("ignora un userId distinto que el 'modelo' intente colar en el input del tool", async () => {
    getSessionHistoryMock.mockResolvedValue({ success: true, data: [] });
    const tool = createGetSessionHistoryTool("real-user-id");

    const rawInputFromModel = {
      desde: "2026-01-01T00:00:00.000Z",
      userId: "attacker-id",
    };
    const parsedInput = tool.parse(rawInputFromModel);
    await tool.run(parsedInput);

    expect(getSessionHistoryMock).toHaveBeenCalledWith("real-user-id", {
      desde: "2026-01-01T00:00:00.000Z",
    });
    expect(getSessionHistoryMock).not.toHaveBeenCalledWith(
      "attacker-id",
      expect.anything(),
    );
  });

  it("propaga el error de dominio serializado cuando getSessionHistory falla", async () => {
    getSessionHistoryMock.mockResolvedValue({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Rango inválido." },
    });
    const tool = createGetSessionHistoryTool("user-1");

    const result = await tool.run({});

    expect(JSON.parse(result as string)).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Rango inválido." },
    });
  });
});

describe("createListExercisesTool", () => {
  beforeEach(() => {
    listExercisesMock.mockReset();
  });

  it("llama a listExercises() sin argumentos y devuelve el catálogo serializado", async () => {
    listExercisesMock.mockResolvedValue([
      { id: "ex-1", name: "Sentadilla", type: "STRENGTH" },
    ] as never);
    const tool = createListExercisesTool();

    const result = await tool.run({});

    expect(listExercisesMock).toHaveBeenCalledWith();
    expect(JSON.parse(result as string)).toEqual([
      { id: "ex-1", name: "Sentadilla", type: "STRENGTH" },
    ]);
  });
});

describe("createSubmitSessionProposalTool", () => {
  it("expone el nombre esperado y un input_schema equivalente al de validate-session.ts", () => {
    const tool = createSubmitSessionProposalTool();

    expect(tool.name).toBe(SUBMIT_SESSION_PROPOSAL_TOOL_NAME);
    // betaZodTool() siempre devuelve un tool `type: "custom"` con
    // input_schema, pero BetaRunnableTool<T> tipa la unión completa de tools
    // client-side (incluye variantes como el memory tool sin input_schema) —
    // el cast es solo para esta aserción de test, no afecta al runtime.
    const customTool = tool as unknown as { input_schema: unknown };
    expect(customTool.input_schema).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        fecha: expect.anything(),
        ejercicios: expect.anything(),
      }),
    });
  });

  it("su run() no ejecuta ninguna acción de dominio (solo es el mecanismo de salida estructurada)", async () => {
    const tool = createSubmitSessionProposalTool();

    await expect(
      tool.run({
        fecha: "2026-01-01T00:00:00.000Z",
        ejercicios: [
          {
            tipo: "fuerza",
            ejercicio: "Sentadilla",
            series: [{ reps: 10, peso_kg: 10 }],
          },
        ],
      }),
    ).resolves.toBeDefined();
  });
});
