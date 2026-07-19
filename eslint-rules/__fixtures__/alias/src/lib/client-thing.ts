"use client";

// Fixture: módulo "use client" resuelto vía el alias "@/*" (tsconfig.json
// de este mismo directorio de fixtures, aislado del tsconfig.json real del
// proyecto), usado por no-client-import-in-server-file.test.ts.
export const clientThing = (): string => "client thing";
