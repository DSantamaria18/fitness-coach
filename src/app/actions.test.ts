import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "@/auth";
import { logout } from "./actions";

const signOutMock = vi.mocked(signOut);

describe("logout", () => {
  beforeEach(() => {
    signOutMock.mockReset();
  });

  it("cierra la sesión redirigiendo a /login", async () => {
    signOutMock.mockResolvedValue(undefined as never);

    await logout();

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
