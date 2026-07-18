import { describe, expect, it } from "vitest";
import { verifyBearerToken } from "./auth";

const TOKEN = "s3cr3t-mcp-token";

describe("verifyBearerToken", () => {
  it("returns true when the header carries the exact expected token", () => {
    expect(verifyBearerToken(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("returns false when the token does not match", () => {
    expect(verifyBearerToken("Bearer wrong-token", TOKEN)).toBe(false);
  });

  it("returns false when the header is missing", () => {
    expect(verifyBearerToken(null, TOKEN)).toBe(false);
  });

  it('returns false when the header does not start with "Bearer "', () => {
    expect(verifyBearerToken(TOKEN, TOKEN)).toBe(false);
    expect(verifyBearerToken(`Basic ${TOKEN}`, TOKEN)).toBe(false);
  });

  // Nunca se debe autenticar contra un secreto no configurado: un
  // MCP_BEARER_TOKEN vacío en el entorno no puede convertirse accidentalmente
  // en "cualquier cosa vale".
  it("returns false when the expected token is empty or undefined", () => {
    expect(verifyBearerToken(`Bearer ${TOKEN}`, "")).toBe(false);
    expect(
      verifyBearerToken(`Bearer ${TOKEN}`, undefined as unknown as string),
    ).toBe(false);
    expect(verifyBearerToken("Bearer ", "")).toBe(false);
  });

  it("returns false when tokens have different lengths (no length-based short circuit)", () => {
    expect(verifyBearerToken(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(verifyBearerToken("Bearer short", TOKEN)).toBe(false);
  });
});
