import { describe, expect, it } from "vitest";
import {
  parseMinutesSeconds,
  formatSecondsAsMinutesSeconds,
} from "./duration-format";

// Corredor real reportó confusión con "Duración (s)"/"Ritmo medio (s/km)":
// piensa en minutos/mm:ss ("8:30"), no en segundos totales. Estas funciones
// puras son la frontera de conversión: el contrato interno (segundos,
// Prisma/Zod) no cambia, solo cómo se teclea/muestra en el formulario.
describe("parseMinutesSeconds", () => {
  it("convierte un mm:ss válido a segundos totales", () => {
    expect(parseMinutesSeconds("8:30")).toEqual({
      success: true,
      seconds: 510,
    });
  });

  it("acepta segundos de un solo dígito informativo cuando son 0", () => {
    expect(parseMinutesSeconds("0:45")).toEqual({ success: true, seconds: 45 });
  });

  it("acepta minutos con o sin cero a la izquierda, con el mismo resultado", () => {
    expect(parseMinutesSeconds("5:30")).toEqual({
      success: true,
      seconds: 330,
    });
    expect(parseMinutesSeconds("05:30")).toEqual({
      success: true,
      seconds: 330,
    });
  });

  it("tolera espacios alrededor del valor", () => {
    expect(parseMinutesSeconds("  8:30  ")).toEqual({
      success: true,
      seconds: 510,
    });
  });

  it("trata la cadena vacía como 'sin valor', no como error (campo opcional)", () => {
    expect(parseMinutesSeconds("")).toEqual({
      success: true,
      seconds: undefined,
    });
    expect(parseMinutesSeconds("   ")).toEqual({
      success: true,
      seconds: undefined,
    });
  });

  // Decisión: los segundos >= 60 dentro del formato se RECHAZAN (no se
  // normalizan arrastrando el minuto), igual que un mm:ss real no permite
  // "8:75" — normalizar en silencio repetiría el mismo tipo de fallo mudo
  // que motivó este bug (toNumber() tragándose "0,1" como NaN). Ver
  // DECISIONS.md.
  it("rechaza segundos fuera de rango (>= 60) en vez de normalizarlos", () => {
    expect(parseMinutesSeconds("8:60")).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(parseMinutesSeconds("8:75")).toEqual({
      success: false,
      error: expect.any(String),
    });
  });

  it("rechaza valores negativos", () => {
    expect(parseMinutesSeconds("-5:30")).toEqual({
      success: false,
      error: expect.any(String),
    });
  });

  it("rechaza formato claramente inválido", () => {
    expect(parseMinutesSeconds("abc")).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(parseMinutesSeconds("8:")).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(parseMinutesSeconds("8:600")).toEqual({
      success: false,
      error: expect.any(String),
    });
    expect(parseMinutesSeconds("8")).toEqual({
      success: false,
      error: expect.any(String),
    });
  });
});

describe("formatSecondsAsMinutesSeconds", () => {
  it("formatea segundos totales como mm:ss canónico (segundos siempre a 2 dígitos)", () => {
    expect(formatSecondsAsMinutesSeconds(510)).toBe("8:30");
    expect(formatSecondsAsMinutesSeconds(45)).toBe("0:45");
    expect(formatSecondsAsMinutesSeconds(1800)).toBe("30:00");
  });

  it("no añade cero a la izquierda en los minutos (forma canónica)", () => {
    expect(formatSecondsAsMinutesSeconds(330)).toBe("5:30");
  });

  it("trata negativos/valores no finitos como 0 en vez de propagar un formato inválido", () => {
    expect(formatSecondsAsMinutesSeconds(-10)).toBe("0:00");
  });
});

describe("round-trip parseMinutesSeconds <-> formatSecondsAsMinutesSeconds", () => {
  it("formatear el resultado de parsear devuelve el mismo mm:ss canónico", () => {
    for (const canonical of ["8:30", "0:45", "5:30", "30:00", "0:00"]) {
      const parsed = parseMinutesSeconds(canonical);
      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;
      expect(formatSecondsAsMinutesSeconds(parsed.seconds ?? 0)).toBe(
        canonical,
      );
    }
  });
});
