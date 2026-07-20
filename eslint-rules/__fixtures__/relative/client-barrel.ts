// Fixture: barrel sin directiva propia que reexporta (export *) de un
// fichero "use client" — el hueco de cobertura de BL-016: BL-001 solo
// comprobaba la directiva del fichero resuelto DIRECTAMENTE por el import,
// y este barrel no tiene ninguna directiva propia, así que se colaba sin
// detectarse.
export * from "./client-module";
