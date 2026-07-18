import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateBodyWeight } from "@/lib/update-body-weight";
import { deleteBodyWeight } from "@/lib/delete-body-weight";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "El cuerpo de la petición no es JSON válido.",
        },
      },
      { status: 400 },
    );
  }

  const { id } = await params;

  // userId sale de la sesión, nunca del body: update-body-weight.ts comprueba
  // la pertenencia del registro antes de escribir.
  const result = await updateBodyWeight(userId, id, body);
  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "No autenticado." } },
      { status: 401 },
    );
  }

  const { id } = await params;

  const result = await deleteBodyWeight(userId, id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
