// Tipo de error compartido por las 3 mutaciones del catálogo de ejercicios
// (create/rename/delete). A diferencia de session/body-weight (donde el tipo
// vive en el módulo "update-*.ts" y el "delete-*.ts" solo importa la rama
// que necesita — ver update-session.ts/delete-session.ts), aquí las 3
// mutaciones comparten el mismo shape por igual y ninguna es más "dueña" que
// las otras, así que vive en su propio módulo en vez de forzar una
// dependencia arbitraria de create/delete hacia rename.
export type ExerciseMutationError =
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "IN_USE"; message: string };
