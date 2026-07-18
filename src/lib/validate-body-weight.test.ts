import { describe, expect, it } from "vitest";
import { validateBodyWeight } from "./validate-body-weight";

describe("validateBodyWeight", () => {
  it("accepts a valid weight and today's date", () => {
    const result = validateBodyWeight({
      weightKg: 82.5,
      date: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid weight and a past date", () => {
    const result = validateBodyWeight({
      weightKg: 82.5,
      date: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a weight of zero or below", () => {
    const result = validateBodyWeight({
      weightKg: 0,
      date: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unrealistically high weight", () => {
    const result = validateBodyWeight({
      weightKg: 400,
      date: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("rejects a future date", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = validateBodyWeight({
      weightKg: 82.5,
      date: tomorrow.toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid date string", () => {
    const result = validateBodyWeight({
      weightKg: 82.5,
      date: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric weight", () => {
    const result = validateBodyWeight({
      weightKg: "eighty",
      date: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});
