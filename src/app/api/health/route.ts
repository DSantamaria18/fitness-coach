import { NextResponse } from "next/server";

// Healthcheck de *liveness* (¿el servidor responde?), no de *readiness*: a
// propósito no hace round-trip a la base de datos. Turso factura por lectura
// y un monitor externo puede sondear con frecuencia; una comprobación de BD
// aquí gastaría cuota y podría dar falsos negativos por latencia de red sin
// que la app en sí esté caída. Tampoco expone versión, entorno ni ningún
// dato sensible: solo confirma que el proceso está vivo.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
