import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createBodyWeight } from "@/lib/create-body-weight";

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la petición no es JSON válido." },
      { status: 400 },
    );
  }

  // userId sale de la sesión, nunca del body: evita que el cliente escriba
  // datos a nombre de otro usuario (ver CLAUDE.md regla 7).
  const result = await createBodyWeight(userId, body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 201 });
}
