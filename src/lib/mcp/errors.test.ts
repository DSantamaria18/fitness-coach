import { describe, expect, it } from "vitest";
import { toMcpToolError } from "./errors";

describe("toMcpToolError", () => {
  // create-body-weight.ts y create-session.ts devuelven el error como string
  // plano (a diferencia del resto de la capa de dominio): se normaliza a
  // VALIDATION_ERROR porque en la práctica es el único caso en que fallan.
  it("wraps a plain string error as a VALIDATION_ERROR", () => {
    expect(toMcpToolError("Revisa el peso y la fecha introducidos.")).toEqual({
      code: "VALIDATION_ERROR",
      message: "Revisa el peso y la fecha introducidos.",
    });
  });

  it("passes an already-structured {code,message} error through unchanged", () => {
    const error = { code: "NOT_FOUND", message: "Registro no encontrado." };
    expect(toMcpToolError(error)).toEqual(error);
  });
});
