import { describe, expect, it, vi, beforeEach } from "vitest";

// Mockeamos el cliente @anthropic-ai/sdk por completo: nunca una llamada
// real a la API en tests/CI (SPEC.md §14 punto 2 / instrucciones Tech
// Lead) — coste real y no determinista.
const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

import type { ProgressReportData } from "@/lib/get-progress-report";
import { generateProgressComment } from "./generate-progress-comment";

const sampleReport: ProgressReportData = {
  bodyWeight: [{ date: new Date("2026-07-01T00:00:00.000Z"), weightKg: 80 }],
  frequency: {
    totalSessions: 4,
    sessionsPerWeek: 2,
    currentStreakWeeks: 2,
  },
};

describe("generateProgressComment", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("devuelve el texto generado por Claude a partir del informe serializado", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Vas progresando de forma constante." }],
    });

    const result = await generateProgressComment(sampleReport);

    expect(result).toEqual({
      success: true,
      texto: "Vas progresando de forma constante.",
    });
    // Llamada simple: sin tools, sin toolRunner (ver SPEC.md §14 punto 2).
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.tools).toBeUndefined();
    expect(callArgs.messages).toHaveLength(1);
    // El informe serializado viaja como contexto de la llamada.
    expect(JSON.stringify(callArgs)).toContain("totalSessions");
  });

  it("no lanza y devuelve un error controlado si la llamada a la API falla (red/API)", async () => {
    createMock.mockRejectedValue(new Error("network error"));

    const result = await generateProgressComment(sampleReport);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toEqual(expect.any(String));
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("devuelve un error controlado si la respuesta no trae ningún bloque de texto", async () => {
    createMock.mockResolvedValue({ content: [] });

    const result = await generateProgressComment(sampleReport);

    expect(result.success).toBe(false);
  });
});
