import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Home from "./page";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const redirectMock = redirect as unknown as ReturnType<typeof vi.fn>;

describe("Home (/)", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirige a /historial cuando hay sesión iniciada", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });

    await Home();

    expect(redirectMock).toHaveBeenCalledWith("/historial");
    expect(redirectMock).not.toHaveBeenCalledWith("/login");
  });

  it("redirige a /login cuando no hay sesión", async () => {
    authMock.mockResolvedValue(null);

    await Home();

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).not.toHaveBeenCalledWith("/historial");
  });
});
