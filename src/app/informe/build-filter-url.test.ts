import { describe, expect, it } from "vitest";
import { buildFilterUrl } from "./build-filter-url";

describe("buildFilterUrl", () => {
  it("devuelve /informe sin query si no hay parámetros", () => {
    const url = buildFilterUrl(new URLSearchParams(), {});

    expect(url).toBe("/informe");
  });

  it("añade un parámetro nuevo", () => {
    const url = buildFilterUrl(new URLSearchParams(), {
      ejercicio: "Sentadilla",
    });

    expect(url).toBe("/informe?ejercicio=Sentadilla");
  });

  it("preserva los parámetros existentes que no se están modificando", () => {
    const current = new URLSearchParams("ejercicio=Sentadilla");
    const url = buildFilterUrl(current, { desde: "2026-07-01" });

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("ejercicio")).toBe("Sentadilla");
    expect(params.get("desde")).toBe("2026-07-01");
  });

  it("elimina un parámetro cuando el valor es null", () => {
    const current = new URLSearchParams(
      "ejercicio=Sentadilla&desde=2026-07-01",
    );
    const url = buildFilterUrl(current, { ejercicio: null });

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.has("ejercicio")).toBe(false);
    expect(params.get("desde")).toBe("2026-07-01");
  });

  it("elimina un parámetro cuando el valor es cadena vacía", () => {
    const current = new URLSearchParams("desde=2026-07-01");
    const url = buildFilterUrl(current, { desde: "" });

    expect(url).toBe("/informe");
  });

  it("devuelve /informe sin '?' cuando el resultado no tiene parámetros", () => {
    const current = new URLSearchParams("ejercicio=Sentadilla");
    const url = buildFilterUrl(current, { ejercicio: null });

    expect(url).toBe("/informe");
  });

  it("codifica valores con caracteres especiales (vía URLSearchParams, espacios como '+')", () => {
    const url = buildFilterUrl(new URLSearchParams(), {
      ejercicio: "Press banca & remo",
    });

    expect(url).toBe("/informe?ejercicio=Press+banca+%26+remo");
  });
});
