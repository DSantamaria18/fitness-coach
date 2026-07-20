// Fixture: barrel sin directiva propia que reexporta de un fichero SIN
// directiva (server-safe de punta a punta), usado por
// no-client-import-in-server-file.test.ts para el caso válido de BL-016:
// la cadena de re-exports no encuentra ningún "use client" en ningún punto.
export * from "./plain-module";
