import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createBodyWeight } from "@/lib/create-body-weight";
import { getBodyWeightHistory } from "@/lib/get-body-weight-history";

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  // Parámetros opcionales desde/hasta (SPEC §4.4); ausentes se pasan como
  // undefined, no como cadena vacía, para que el esquema Zod los trate
  // como "sin filtro" en vez de como fecha inválida.
  const { searchParams } = new URL(request.url);
  const result = await getBodyWeightHistory(userId, {
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 200 });
}

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
