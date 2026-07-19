import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/create-session", () => ({
  createSession: vi.fn(),
}));

vi.mock("@/lib/session-proposal/generate-session-proposal", () => ({
  generateSessionProposal: vi.fn(),
}));

import { auth } from "@/auth";
import { generateSessionProposal } from "@/lib/session-proposal/generate-session-proposal";
import { generateSessionProposalAction } from "./actions";

// `auth` es una función sobrecargada (uso directo y como middleware); vi.mocked
// infiere una intersección inservible para mockResolvedValue, así que se trata
// como un mock genérico (mismo criterio que api/sessions/route.test.ts).
const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const generateSessionProposalMock = vi.mocked(generateSessionProposal);

describe("generateSessionProposalAction", () => {
  beforeEach(() => {
    authMock.mockReset();
    generateSessionProposalMock.mockReset();
  });

  it("devuelve un aviso discreto sin llamar a la IA cuando no hay sesión autenticada", async () => {
    authMock.mockResolvedValue(null);

    const result = await generateSessionProposalAction();

    expect(result).toEqual({ success: false, message: "No autenticado." });
    expect(generateSessionProposalMock).not.toHaveBeenCalled();
  });

  it("devuelve un aviso discreto cuando generateSessionProposal falla", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    generateSessionProposalMock.mockResolvedValue({
      success: false,
      error: { code: "TIMEOUT", message: "Se agotó el tiempo de espera." },
    });

    const result = await generateSessionProposalAction();

    expect(result).toEqual({
      success: false,
      message:
        "No se pudo generar la propuesta con IA. Puedes registrar la sesión manualmente.",
    });
  });

  // Regresión: buildInitialRegistros vive en session-entries-editor.tsx
  // ("use client"), y actions.ts es una Server Action ("use server"). RSC
  // sustituye las exportaciones de un módulo cliente por una referencia
  // opaca al importarlas desde el servidor — invocar buildInitialRegistros
  // aquí lanzaba "Attempted to call buildInitialRegistros() from the server
  // but buildInitialRegistros is on the client" de forma determinista en
  // cuanto la IA tenía éxito. No se mockea buildInitialRegistros (ni el
  // módulo que la contiene): este test solo mockea la llamada a la IA y
  // comprueba el resultado final real de la Server Action, para que un
  // futuro cambio que reintroduzca el import desde un módulo "use client"
  // lo detecte. Ver DECISIONS.md 2026-07-19.
  it("convierte la propuesta de la IA en el estado inicial del editor sin lanzar (camino de éxito)", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", username: "david" },
      expires: "",
    } as never);
    generateSessionProposalMock.mockResolvedValue({
      success: true,
      data: {
        fecha: "2026-07-19T08:00:00.000Z",
        ejercicios: [
          {
            tipo: "fuerza",
            ejercicio: "Sentadilla",
            series: [{ reps: 5, peso_kg: 100, tempo: "3-1-1", RPE: 8 }],
          },
          {
            tipo: "cardio",
            ejercicio: "Carrera",
            duracion: 1800,
            distancia_km: 5,
            RPE: 6,
          },
        ],
      } as never,
    });

    const result = await generateSessionProposalAction();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.fecha).toBe("2026-07-19");
    expect(result.registros).toHaveLength(2);
    expect(result.registros[0]).toMatchObject({
      tipo: "fuerza",
      ejercicio: "Sentadilla",
      notas: "",
      series: [{ reps: "5", peso_kg: "100", tempo: "3-1-1", RPE: "8" }],
    });
    expect(result.registros[1]).toMatchObject({
      tipo: "cardio",
      ejercicio: "Carrera",
      duracion: "1800",
      distancia_km: "5",
      RPE: "6",
    });
    // Claves de React generadas por el conversor, no vacías/duplicadas.
    expect(result.registros[0].key).toBeTruthy();
    expect(result.registros[1].key).toBeTruthy();
    expect(result.registros[0].key).not.toBe(result.registros[1].key);
  });
});
