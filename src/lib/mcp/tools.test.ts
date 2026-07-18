import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/create-body-weight", () => ({ createBodyWeight: vi.fn() }));
vi.mock("@/lib/get-body-weight-history", () => ({
  getBodyWeightHistory: vi.fn(),
}));
vi.mock("@/lib/create-session", () => ({ createSession: vi.fn() }));
vi.mock("@/lib/update-session", () => ({ updateSession: vi.fn() }));
vi.mock("@/lib/get-session-history", () => ({ getSessionHistory: vi.fn() }));
vi.mock("@/lib/list-exercises", () => ({ listExercises: vi.fn() }));
vi.mock("@/lib/get-progress-report", () => ({ getProgressReport: vi.fn() }));

import { createBodyWeight } from "@/lib/create-body-weight";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";
import { createSession } from "@/lib/create-session";
import { updateSession } from "@/lib/update-session";
import { getSessionHistory } from "@/lib/get-session-history";
import { listExercises } from "@/lib/list-exercises";
import { getProgressReport } from "@/lib/get-progress-report";
import {
  logWeightTool,
  getWeightHistoryTool,
  logSessionTool,
  editSessionTool,
  getSessionHistoryTool,
  listExercisesTool,
  getProgressReportTool,
} from "./tools";

const createBodyWeightMock = vi.mocked(createBodyWeight);
const getBodyWeightHistoryMock = vi.mocked(getBodyWeightHistory);
const createSessionMock = vi.mocked(createSession);
const updateSessionMock = vi.mocked(updateSession);
const getSessionHistoryMock = vi.mocked(getSessionHistory);
const listExercisesMock = vi.mocked(listExercises);
const getProgressReportMock = vi.mocked(getProgressReport);

const USER_ID = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logWeightTool", () => {
  it("returns the created record on success", async () => {
    createBodyWeightMock.mockResolvedValue({
      success: true,
      data: { id: "bw-1", weightKg: 80, date: new Date("2026-07-17") },
    });

    const result = await logWeightTool(USER_ID, { weightKg: 80 });

    expect(result).toEqual({
      success: true,
      data: { id: "bw-1", weightKg: 80, date: new Date("2026-07-17") },
    });
    expect(createBodyWeightMock).toHaveBeenCalledWith(USER_ID, {
      weightKg: 80,
    });
  });

  // createBodyWeight devuelve un string plano de error (no {code,message}):
  // la tool debe normalizarlo con toMcpToolError.
  it("normalizes the plain-string domain error into {code,message}", async () => {
    createBodyWeightMock.mockResolvedValue({
      success: false,
      error: "Revisa el peso y la fecha introducidos.",
    });

    const result = await logWeightTool(USER_ID, { weightKg: -5 });

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa el peso y la fecha introducidos.",
      },
    });
  });
});

describe("getWeightHistoryTool", () => {
  it("returns the history on success", async () => {
    getBodyWeightHistoryMock.mockResolvedValue({
      success: true,
      data: [{ id: "bw-1", weightKg: 80, date: new Date("2026-07-17") }],
    });

    const result = await getWeightHistoryTool(USER_ID, {});

    expect(result).toEqual({
      success: true,
      data: [{ id: "bw-1", weightKg: 80, date: new Date("2026-07-17") }],
    });
  });

  it("passes through the already-structured domain error unchanged", async () => {
    getBodyWeightHistoryMock.mockResolvedValue({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Revisa el rango." },
    });

    const result = await getWeightHistoryTool(USER_ID, { desde: "bad" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Revisa el rango." },
    });
  });
});

describe("logSessionTool", () => {
  it("returns the created session on success", async () => {
    createSessionMock.mockResolvedValue({
      success: true,
      data: { id: "s-1", date: new Date("2026-07-17") },
    });

    const result = await logSessionTool(USER_ID, {
      fecha: "2026-07-17T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result).toEqual({
      success: true,
      data: { id: "s-1", date: new Date("2026-07-17") },
    });
  });

  // create-session.ts también devuelve error como string plano, igual que
  // create-body-weight.ts.
  it("normalizes the plain-string domain error into {code,message}", async () => {
    createSessionMock.mockResolvedValue({
      success: false,
      error: "Revisa los ejercicios y la fecha introducidos.",
    });

    const result = await logSessionTool(USER_ID, {});

    expect(result).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los ejercicios y la fecha introducidos.",
      },
    });
  });
});

describe("editSessionTool", () => {
  it("extracts the id and forwards the rest of the input to updateSession", async () => {
    updateSessionMock.mockResolvedValue({
      success: true,
      data: { id: "s-1", date: new Date("2026-07-18") },
    });

    const result = await editSessionTool(USER_ID, {
      id: "s-1",
      fecha: "2026-07-18T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result).toEqual({
      success: true,
      data: { id: "s-1", date: new Date("2026-07-18") },
    });
    expect(updateSessionMock).toHaveBeenCalledWith(USER_ID, "s-1", {
      fecha: "2026-07-18T08:00:00.000Z",
      ejercicios: [],
    });
  });

  it("passes through the already-structured domain error unchanged", async () => {
    updateSessionMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "Sesión no encontrada." },
    });

    const result = await editSessionTool(USER_ID, {
      id: "missing",
      fecha: "2026-07-18T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Sesión no encontrada." },
    });
  });

  // Sin id no hay nada que editar: se rechaza antes de llegar a Prisma.
  it("returns a validation error without calling updateSession when id is missing", async () => {
    const result = await editSessionTool(USER_ID, {
      fecha: "2026-07-18T08:00:00.000Z",
      ejercicios: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("returns a validation error without calling updateSession when input is not an object", async () => {
    const result = await editSessionTool(USER_ID, "not-an-object");

    expect(result.success).toBe(false);
    expect(updateSessionMock).not.toHaveBeenCalled();
  });
});

describe("getSessionHistoryTool", () => {
  it("returns the session history on success", async () => {
    getSessionHistoryMock.mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await getSessionHistoryTool(USER_ID, {});

    expect(result).toEqual({ success: true, data: [] });
  });

  it("passes through the already-structured domain error unchanged", async () => {
    getSessionHistoryMock.mockResolvedValue({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Revisa el rango." },
    });

    const result = await getSessionHistoryTool(USER_ID, { desde: "bad" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Revisa el rango." },
    });
  });
});

describe("listExercisesTool", () => {
  // list-exercises.ts es catálogo global: ignora userId e input.
  it("returns the exercise catalog, ignoring userId and input", async () => {
    listExercisesMock.mockResolvedValue([
      {
        id: "ex-1",
        name: "Sentadilla",
        type: "STRENGTH",
        createdAt: new Date(),
      },
    ]);

    const result = await listExercisesTool(USER_ID, { anything: true });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "ex-1",
          name: "Sentadilla",
          type: "STRENGTH",
          createdAt: expect.any(Date),
        },
      ],
    });
  });
});

describe("getProgressReportTool", () => {
  it("returns the progress report on success", async () => {
    getProgressReportMock.mockResolvedValue({
      success: true,
      data: {
        bodyWeight: [],
        frequency: {
          totalSessions: 0,
          sessionsPerWeek: 0,
          currentStreakWeeks: 0,
        },
      },
    });

    const result = await getProgressReportTool(USER_ID, {});

    expect(result.success).toBe(true);
  });

  it("passes through the already-structured NOT_FOUND domain error unchanged", async () => {
    getProgressReportMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: 'El ejercicio "X" no existe.' },
    });

    const result = await getProgressReportTool(USER_ID, { ejercicio: "X" });

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: 'El ejercicio "X" no existe.' },
    });
  });
});
