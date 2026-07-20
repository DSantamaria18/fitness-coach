// Fixture: primer eslabón de una cadena de DOS barrels sin directiva propia
// (barrel-a -> barrel-b -> client-module), usado para confirmar que la
// recursión de BL-016 sigue más de un salto, no solo uno.
export * from "./barrel-b";
