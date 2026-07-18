import { createHash, timingSafeEqual } from "node:crypto";

// SHA-256 antes de comparar: además de evitar el timing attack del propio
// contenido (timingSafeEqual), normaliza la longitud del buffer a comparar,
// así el intento nunca puede filtrar la longitud real del token esperado
// aunque authorizationHeader y expectedToken midan cosas distintas.
function hash(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Nunca autentica contra un secreto no configurado (expectedToken vacío):
// el servidor no debe quedarse "abierto" si MCP_BEARER_TOKEN no se rellenó.
export function verifyBearerToken(
  authorizationHeader: string | null,
  expectedToken: string,
): boolean {
  if (!expectedToken) return false;
  if (!authorizationHeader?.startsWith("Bearer ")) return false;

  const providedToken = authorizationHeader.slice("Bearer ".length);
  return timingSafeEqual(hash(providedToken), hash(expectedToken));
}
