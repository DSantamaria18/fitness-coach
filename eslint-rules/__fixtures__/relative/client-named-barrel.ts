// Fixture: mismo caso que client-barrel.ts, pero con la forma de re-export
// nombrado ("export { x } from") en vez de "export *" — confirma que la
// regla cubre ambas sintaxis de re-export vía módulo.
export { helper } from "./client-module";
