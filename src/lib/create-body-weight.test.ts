import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bodyWeight: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createBodyWeight } from "./create-body-weight";

const createMock = vi.mocked(prisma.bodyWeight.create);

describe("createBodyWeight", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("persists the entry under the given userId when the input is valid", async () => {
    createMock.mockResolvedValue({
      id: "bw-1",
      userId: "user-1",
      date: new Date("2026-07-17T08:00:00.000Z"),
      weightKg: 80.5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createBodyWeight("user-1", {
      weightKg: 80.5,
      date: "2026-07-17T08:00:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        weightKg: 80.5,
        date: new Date("2026-07-17T08:00:00.000Z"),
      },
    });
  });

  it("returns a failure result without touching Prisma when the input is invalid", async () => {
    const result = await createBodyWeight("user-1", {
      weightKg: -5,
      date: "2026-07-17T08:00:00.000Z",
    });

    expect(result.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});
