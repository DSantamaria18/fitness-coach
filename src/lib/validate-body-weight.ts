import { z } from "zod";

// Rango razonable para un humano adulto; descarta errores de entrada (ej. gramos en vez de kg).
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 300;

export const bodyWeightSchema = z.object({
  weightKg: z.number().gt(0).min(MIN_WEIGHT_KG).max(MAX_WEIGHT_KG),
  date: z.iso.datetime().refine((value) => new Date(value) <= new Date(), {
    message: "La fecha no puede ser futura.",
  }),
});

export type BodyWeightInput = z.input<typeof bodyWeightSchema>;
export type ValidatedBodyWeight = z.output<typeof bodyWeightSchema>;

export function validateBodyWeight(input: unknown) {
  return bodyWeightSchema.safeParse(input);
}
