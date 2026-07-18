import { z } from "zod";

// Mismo criterio de "no futura" que validate-body-weight.ts.
const fechaSchema = z.iso
  .datetime()
  .refine((value) => new Date(value) <= new Date(), {
    message: "La fecha no puede ser futura.",
  });

const rpeSchema = z.number().int().min(1).max(10);

const serieSchema = z.object({
  reps: z.number().int().positive(),
  peso_kg: z.number().positive(),
  tempo: z.string().optional(),
  RPE: rpeSchema.optional(),
});

const registroFuerzaSchema = z.object({
  tipo: z.literal("fuerza"),
  ejercicio: z.string().min(1),
  series: z.array(serieSchema).min(1),
  notas: z.string().optional(),
});

// Todos los campos numéricos son opcionales individualmente (SPEC §3): no
// todos los relojes/pulseras miden todo.
const registroCardioSchema = z.object({
  tipo: z.literal("cardio"),
  ejercicio: z.string().min(1),
  duracion: z.number().int().positive().optional(),
  distancia_km: z.number().positive().optional(),
  velocidad_media: z.number().positive().optional(),
  ritmo_medio: z.number().int().positive().optional(),
  frecuencia_cardiaca_media: z.number().int().positive().optional(),
  frecuencia_cardiaca_maxima: z.number().int().positive().optional(),
  pasos: z.number().int().positive().optional(),
  frecuencia_paso: z.number().positive().optional(),
  kcal: z.number().int().positive().optional(),
  RPE: rpeSchema.optional(),
  notas: z.string().optional(),
});

const registroEjercicioSchema = z.discriminatedUnion("tipo", [
  registroFuerzaSchema,
  registroCardioSchema,
]);

export const sessionSchema = z.object({
  fecha: fechaSchema,
  // La existencia del ejercicio en el catálogo (y que su tipo coincida con
  // fuerza/cardio) se valida contra la base de datos en create-session.ts,
  // no aquí: Zod solo valida la forma del dato, no su existencia.
  ejercicios: z.array(registroEjercicioSchema).min(1),
});

export type SessionInput = z.input<typeof sessionSchema>;
export type ValidatedSession = z.output<typeof sessionSchema>;
export type ValidatedRegistroEjercicio = z.output<
  typeof registroEjercicioSchema
>;

export function validateSession(input: unknown) {
  return sessionSchema.safeParse(input);
}
