import { describe, expect, it, vi } from "vitest";
import { resolveMcpUserId } from "./resolve-user";

describe("resolveMcpUserId", () => {
  it("returns the user id when the username exists", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "david",
      passwordHash: "hash",
    });

    const userId = await resolveMcpUserId({ user: { findUnique } }, "david");

    expect(userId).toBe("user-1");
    expect(findUnique).toHaveBeenCalledWith({ where: { username: "david" } });
  });

  it("returns null when the username does not exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const userId = await resolveMcpUserId({ user: { findUnique } }, "unknown");

    expect(userId).toBeNull();
  });
});
