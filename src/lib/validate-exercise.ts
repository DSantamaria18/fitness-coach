import { z } from "zod";

// Mismo shape de validación para alta y renombrado (create-exercise.ts y
// rename-exercise.ts): nombre no vacío (recortado) y tipo restringido al
// enum de Prisma. trim() antes de min(1) para que " " (solo espacios) no
// cuele como nombre válido.
export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["STRENGTH", "CARDIO"]),
});

export type ExerciseInput = z.input<typeof exerciseInputSchema>;
export type ValidatedExerciseInput = z.output<typeof exerciseInputSchema>;

export function validateExerciseInput(input: unknown) {
  return exerciseInputSchema.safeParse(input);
}
