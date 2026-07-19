"use client";

// Fixture: módulo "use client", usado por no-client-import-in-server-file.test.ts
// para reproducir el caso real del bug de buildInitialRegistros (import
// relativo desde un módulo "use server").
export const helper = (): string => "client value";
