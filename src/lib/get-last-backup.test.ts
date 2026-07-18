import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    backup: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getLastBackup } from "./get-last-backup";

const findFirstMock = vi.mocked(prisma.backup.findFirst);

describe("getLastBackup", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("devuelve la fecha del backup más reciente del userId dado", async () => {
    findFirstMock.mockResolvedValue({
      id: "backup-1",
      userId: "user-1",
      createdAt: new Date("2026-07-18T10:00:00.000Z"),
    });

    const result = await getLastBackup("user-1");

    expect(result).toEqual(new Date("2026-07-18T10:00:00.000Z"));
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("devuelve null cuando el usuario nunca ha hecho un backup", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await getLastBackup("user-1");

    expect(result).toBeNull();
  });
});
