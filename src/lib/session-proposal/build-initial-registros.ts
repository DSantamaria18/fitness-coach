// Conversor puro (sin JSX, sin hooks) de "ejercicios ya registrados/
// propuestos" al estado local que edita SessionEntriesEditor. Vivía dentro
// de session-entries-editor.tsx ("use client"), pero generateSessionProposalAction
// (Server Action en app/sesion/actions.ts) también lo necesita para convertir
// la propuesta de la IA antes de devolverla al cliente. RSC prohíbe invocar
// desde el servidor una función exportada por un módulo "use client" — sus
// exports se sustituyen por referencias opacas al empaquetar — así que esta
// lógica vive en un módulo sin directiva, importable desde ambos lados. Ver
// DECISIONS.md 2026-07-19.

export type CardioMetricKey =
  | "duracion"
  | "distancia_km"
  | "velocidad_media"
  | "ritmo_medio"
  | "frecuencia_cardiaca_media"
  | "frecuencia_cardiaca_maxima"
  | "pasos"
  | "frecuencia_paso"
  | "kcal"
  | "RPE";

type SerieState = { reps: string; peso_kg: string; tempo: string; RPE: string };

type FuerzaRegistroState = {
  key: string;
  tipo: "fuerza";
  ejercicio: string;
  series: SerieState[];
  notas: string;
};

type CardioRegistroState = {
  key: string;
  tipo: "cardio";
  ejercicio: string;
  notas: string;
} & Record<CardioMetricKey, string>;

export type RegistroState = FuerzaRegistroState | CardioRegistroState;

// Forma de "ejercicio ya registrado" que le pasa el Server Component padre
// al abrir el formulario de edición: mismos campos (en español) que
// devuelve get-session-history.ts/consume validate-session.ts, para no
// inventar un DTO paralelo. A diferencia de ValidatedRegistroEjercicio (Zod,
// campos opcionales como `T | undefined`), aquí los numéricos llegan como
// `T | null` porque salen directamente de Prisma. generateSessionProposal
// (ValidatedSession.ejercicios) es estructuralmente compatible con esta
// forma también, ver actions.ts.
export type SessionEntryInitialData =
  | {
      tipo: "fuerza";
      ejercicio: string;
      notas?: string | null;
      series: {
        reps: number;
        peso_kg: number;
        tempo?: string | null;
        RPE?: number | null;
      }[];
    }
  | {
      tipo: "cardio";
      ejercicio: string;
      notas?: string | null;
      duracion?: number | null;
      distancia_km?: number | null;
      velocidad_media?: number | null;
      ritmo_medio?: number | null;
      frecuencia_cardiaca_media?: number | null;
      frecuencia_cardiaca_maxima?: number | null;
      pasos?: number | null;
      frecuencia_paso?: number | null;
      kcal?: number | null;
      RPE?: number | null;
    };

function toInputString(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

// Contador simple para claves de React estables entre añadir/quitar bloques;
// no necesita ser criptográfico, solo único dentro del ciclo de vida de
// quien lo consume (una pestaña de navegador para SessionEntriesEditor, una
// invocación de Server Action para buildInitialRegistros) — cada lado del
// límite servidor/cliente tiene su propia instancia de este módulo, así que
// el contador no se comparte entre ambos, solo dentro de cada uno.
let registroSequence = 0;
export function nextRegistroKey() {
  registroSequence += 1;
  return `registro-${registroSequence}`;
}

// Convierte ejercicios ya guardados (get-session-history.ts, formulario de
// edición de /historial) o propuestos por la IA (generateSessionProposal,
// generateSessionProposalAction) al estado local (todo strings) que edita
// SessionEntriesEditor.
export function buildInitialRegistros(
  entries: SessionEntryInitialData[],
): RegistroState[] {
  return entries.map((entry) => {
    if (entry.tipo === "fuerza") {
      return {
        key: nextRegistroKey(),
        tipo: "fuerza",
        ejercicio: entry.ejercicio,
        notas: entry.notas ?? "",
        series: entry.series.map((serie) => ({
          reps: String(serie.reps),
          peso_kg: String(serie.peso_kg),
          tempo: serie.tempo ?? "",
          RPE: toInputString(serie.RPE),
        })),
      };
    }

    return {
      key: nextRegistroKey(),
      tipo: "cardio",
      ejercicio: entry.ejercicio,
      notas: entry.notas ?? "",
      duracion: toInputString(entry.duracion),
      distancia_km: toInputString(entry.distancia_km),
      velocidad_media: toInputString(entry.velocidad_media),
      ritmo_medio: toInputString(entry.ritmo_medio),
      frecuencia_cardiaca_media: toInputString(entry.frecuencia_cardiaca_media),
      frecuencia_cardiaca_maxima: toInputString(
        entry.frecuencia_cardiaca_maxima,
      ),
      pasos: toInputString(entry.pasos),
      frecuencia_paso: toInputString(entry.frecuencia_paso),
      kcal: toInputString(entry.kcal),
      RPE: toInputString(entry.RPE),
    };
  });
}
