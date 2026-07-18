import type { Metadata } from "next";
import { auth } from "@/auth";
import { getLastBackup } from "@/lib/get-last-backup";
import { BackupStatus } from "./backup-status";

export const metadata: Metadata = {
  title: "Ajustes — Fitness Coach",
};

// Server Component con I/O (auth() + Prisma vía getLastBackup): sin llamada
// dinámica explícita se arriesgaría al mismo bug que /sesion (ver
// DECISIONS.md), pero auth() ya vuelve la página dinámica automáticamente
// igual que /historial.
export default async function AjustesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const lastBackup = await getLastBackup(userId);

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-xl font-semibold">Ajustes</h1>

      <BackupStatus lastBackup={lastBackup?.toISOString() ?? null} />
    </main>
  );
}
