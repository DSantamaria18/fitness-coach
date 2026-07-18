"use server";

import { auth } from "@/auth";
import { getProgressReport } from "@/lib/get-progress-report";
import { generateProgressComment } from "@/lib/progress-comment/generate-progress-comment";
import { saveProgressComment } from "@/lib/progress-comment/save-progress-comment";

export type GenerateProgressCommentState =
  | { error: string }
  | { success: true; texto: string; generadoEn: string }
  | undefined;

// Encadena getProgressReport -> generateProgressComment -> saveProgressComment
// (SPEC.md §14 punto 2). El comentario es siempre global (sin filtro de
// ejercicio), a diferencia de los gráficos de esta misma página que sí
// respetan el filtro de la URL: es un resumen del progreso completo, no de
// un ejercicio concreto.
//
// userId sale siempre de auth() (regla 7 de CLAUDE.md), nunca del cliente.
// Cualquier fallo en cualquier paso de la cadena se traduce en un aviso
// discreto — nunca lanza hacia la UI, que sigue mostrando los gráficos
// existentes igual que hoy.
// El formulario no tiene campos (solo un botón): useActionState exige
// igualmente ambos parámetros en la firma de la Server Action aunque no se
// usen aquí.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function generateAndSaveProgressComment(
  _prevState: GenerateProgressCommentState,
  _formData: FormData,
): Promise<GenerateProgressCommentState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: "No autenticado." };
  }

  const reportResult = await getProgressReport(userId, {});
  if (!reportResult.success) {
    return { error: "No se ha podido generar el comentario de progreso." };
  }

  const commentResult = await generateProgressComment(reportResult.data);
  if (!commentResult.success) {
    return { error: commentResult.error };
  }

  const saveResult = await saveProgressComment(userId, commentResult.texto);
  if (!saveResult.success) {
    return { error: saveResult.error };
  }

  return {
    success: true,
    texto: saveResult.data.texto,
    generadoEn: saveResult.data.generadoEn.toISOString(),
  };
}
