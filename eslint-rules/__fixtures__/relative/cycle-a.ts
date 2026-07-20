// Fixture: ciclo de re-exports (cycle-a <-> cycle-b) sin ningún fichero
// "use client" en la cadena, usado para confirmar que la protección contra
// ciclos de BL-016 no cuelga ni crashea la regla — simplemente termina sin
// reportar en cuanto vuelve a visitar un fichero ya visto.
export * from "./cycle-b";
