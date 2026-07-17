import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials } from "./verify-credentials";

describe("verifyCredentials", () => {
  it("returns the user when the username exists and the password matches the hash", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery-staple", 10);
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash,
    });

    const user = await verifyCredentials(
      { user: { findUnique } },
      "david",
      "correct-horse-battery-staple",
    );

    expect(user).toEqual({ id: "user-1", username: "david" });
    expect(findUnique).toHaveBeenCalledWith({ where: { username: "david" } });
  });

  it("returns null when the password does not match the hash", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery-staple", 10);
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash,
    });

    const user = await verifyCredentials(
      { user: { findUnique } },
      "david",
      "wrong-password",
    );

    expect(user).toBeNull();
  });

  it("returns null when the username does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const user = await verifyCredentials(
      { user: { findUnique } },
      "unknown",
      "anything",
    );

    expect(user).toBeNull();
  });

  it("returns null when username or password is missing", async () => {
    const findUnique = vi.fn();

    expect(
      await verifyCredentials({ user: { findUnique } }, "", "password"),
    ).toBeNull();
    expect(
      await verifyCredentials({ user: { findUnique } }, "david", ""),
    ).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
