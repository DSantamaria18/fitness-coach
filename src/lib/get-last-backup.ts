import { prisma } from "@/lib/prisma";

// userId es siempre un parámetro explícito (ver DECISIONS.md), para poder
// reutilizar esta consulta igual desde la web que desde el futuro MCP.
export async function getLastBackup(userId: string): Promise<Date | null> {
  const backup = await prisma.backup.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return backup?.createdAt ?? null;
}
