import { z } from "zod";

// Mismo criterio de "no futura" que validate-body-weight.ts.
const fechaSchema = z.iso
  .datetime()
  .refine((value) => new Date(value) <= new Date(), {
    message: "La fecha no puede ser futura.",
  });

const rpeSchema = z.number().int().min(1).max(10);

// La IA (submit_session_proposal, log_session/edit_session vía MCP) trata a
// veces "no aplica" como `null` explícito en vez de omitir la clave —
// comportamiento habitual de tool-use con LLMs, no un dato con significado
// propio en este esquema — así que cualquier campo opcional debe aceptar
// `null` como equivalente a ausente. `z.number().optional()` por sí solo
// rechaza `null` (solo admite `undefined`), lo que tumbaba la sesión entera
// con "expected number, received null" (bug real en producción, ver
// DECISIONS.md 2026-07-25).
const nullableOptional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    schema.optional(),
  );

const serieSchema = z.object({
  reps: z.number().int().positive(),
  // Opcional: ejercicios a peso corporal (Burpees, Dominadas, Flexiones...)
  // no tienen una carga externa que registrar. Cuando SÍ se informa, sigue
  // teniendo que ser positivo — un peso de 0 kg o negativo no tiene sentido
  // físico, así que solo cambia la ausencia del campo, no su validación.
  peso_kg: nullableOptional(z.number().positive()),
  tempo: nullableOptional(z.string()),
  RPE: nullableOptional(rpeSchema),
});

// notas: feedback de David tras la sesión (sensaciones, dolor, contexto) —
// la IA lo lee vía get_session_history, nunca lo escribe. comentario_ia: la
// propia observación de la IA (técnica, progresión sugerida), de solo
// lectura para David en el formulario — campos separados a propósito para
// no mezclar autorías en un único texto (BL-027, ver DECISIONS.md
// 2026-07-25).
const registroFuerzaSchema = z.object({
  tipo: z.literal("fuerza"),
  ejercicio: z.string().min(1),
  series: z.array(serieSchema).min(1),
  notas: nullableOptional(z.string()),
  comentario_ia: nullableOptional(
    z
      .string()
      .describe(
        "Tu propia observación breve sobre este ejercicio (técnica, progresión sugerida), " +
          "si tienes algo útil que decir. Nunca escribas aquí el feedback de David — eso va " +
          "en el campo `notas`, que tú solo lees, no rellenas.",
      ),
  ),
});

// Todos los campos numéricos son opcionales individualmente (SPEC §3): no
// todos los relojes/pulseras miden todo.
const registroCardioSchema = z.object({
  tipo: z.literal("cardio"),
  ejercicio: z.string().min(1),
  duracion: nullableOptional(z.number().int().positive()),
  distancia_km: nullableOptional(z.number().positive()),
  velocidad_media: nullableOptional(z.number().positive()),
  ritmo_medio: nullableOptional(z.number().int().positive()),
  frecuencia_cardiaca_media: nullableOptional(z.number().int().positive()),
  frecuencia_cardiaca_maxima: nullableOptional(z.number().int().positive()),
  pasos: nullableOptional(z.number().int().positive()),
  frecuencia_paso: nullableOptional(z.number().positive()),
  kcal: nullableOptional(z.number().int().positive()),
  RPE: nullableOptional(rpeSchema),
  notas: nullableOptional(z.string()),
  comentario_ia: nullableOptional(
    z
      .string()
      .describe(
        "Tu propia observación breve sobre este ejercicio (técnica, progresión sugerida), " +
          "si tienes algo útil que decir. Nunca escribas aquí el feedback de David — eso va " +
          "en el campo `notas`, que tú solo lees, no rellenas.",
      ),
  ),
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
