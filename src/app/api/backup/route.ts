import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { auth } from "@/auth";
import { createBackup } from "@/lib/create-backup";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Fichero temporal por petición: se sirve y se borra al vuelo, nunca se
  // conserva una copia del backup en el servidor (SPEC §11).
  const destinationPath = path.join(tmpdir(), `backup-${randomUUID()}.db`);

  const result = await createBackup(userId, destinationPath);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  try {
    const file = await readFile(destinationPath);
    const filename = `fitness-coach-backup-${result.data.createdAt
      .toISOString()
      .slice(0, 10)}.db`;

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } finally {
    await unlink(destinationPath).catch(() => undefined);
  }
}
