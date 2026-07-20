# Backlog

Features o defectos pendientes. Formato por entrada: código (`BL-NNN`, secuencial y
permanente — no se reutiliza ni se renumera aunque la entrada se mueva o se elimine),
descripción breve, justificación, dificultad estimada (baja/media/alta). Cuando algo se
implementa, se mueve de aquí a [CHANGELOG.md](CHANGELOG.md) conservando su código.

## Pendiente de aprobación del usuario

- **[BL-002]** **Automatizar el backup manual actual** (subida periódica a almacenamiento externo, p.ej.
  Google Drive o Backblaze B2, en vez de depender de que David pulse "Descargar backup").
  Justificación: hoy el aviso de 30 días en `/ajustes` es la única red de seguridad (ver
  DECISIONS.md 2026-07-18); si en el futuro se quiere eliminar la dependencia de que alguien se
  acuerde, esto lo resolvería. Dificultad: media (requiere elegir proveedor, gestionar
  credenciales, y decidir el disparador — cron interno choca con el auto-stop de Fly.io free
  tier, así que probablemente un GitHub Actions programado contra un endpoint propio).

- **[BL-003]** **Añadir la capa VPN Tailscale al servidor MCP.** Justificación: el servidor MCP (en
  construcción, ver DECISIONS.md 2026-07-18) se despliega por ahora protegido solo por token
  Bearer, sin la segunda capa de VPN que especifica SPEC.md §7 — decisión consciente para no
  bloquear el desarrollo en Fly.io mientras el NAS propio de David no esté montado. Hay que
  volver a esto en cuanto el NAS con Tailscale esté disponible. Dificultad: baja (es
  configuración de red del despliegue, no cambia el código del servidor MCP).

- **[BL-017]** **Revisar el modelo de red tras el pivote a Vercel (Tailscale → internet
  público).** Justificación: SPEC.md §2, §5 y §7 asumen que la webapp y el servidor MCP están
  expuestos **solo a través de la VPN Tailscale, nunca abiertos a internet**. Vercel (Hobby)
  sirve la app en internet público (no ofrece Tailscale), así que la protección pasa a ser
  login + token en lugar de una frontera de red — cambio de postura de seguridad que la entrada
  del pivote (DECISIONS.md 2026-07-20) no abordó. Hay que decidir: (a) aceptar login/token como
  única capa para la web, y (b) qué pasa con el servidor MCP, que dependía explícitamente de la
  VPN (SPEC.md §5/§7) — ¿se queda solo con Bearer token en Vercel, se mantiene fuera de Vercel,
  o se pospone su exposición hasta tener el NAS con Tailscale (relacionado con BL-003)?
  Dificultad: baja-media (es sobre todo una decisión de producto/seguridad de David y actualizar
  §2/§5/§7, no código nuevo).

- **[BL-018]** **Definir qué reciben los preview deployments de Vercel sin la Turso de
  producción.** Justificación: por el guardrail de seguridad (las credenciales de Turso son
  scope Production únicamente, ver DECISIONS.md 2026-07-20 infra fase 1), los preview
  deployments no tienen `TURSO_DATABASE_URL`. Hay que decidir el comportamiento: fallar rápido
  con un mensaje claro, o conectar a un SQLite efímero de `/tmp` para poder revisar la UI en el
  preview. Toca el adapter de Prisma para Turso (`feature/despliegue-turso-adapter`), por eso se
  resuelve en fase 2 y no a ciegas ahora. Dificultad: baja (leer `VERCEL_ENV` y ramificar la
  construcción del cliente Prisma).

## Iteraciones futuras ya acordadas (no implementar todavía)

- **[BL-011]** **Integración con wearable** (pasos, sueño, frecuencia cardiaca). Justificación: ampliar el
  seguimiento más allá del entreno de fuerza. Dificultad: alta (depende de APIs externas de
  terceros, aún por decidir cuál).
- **[BL-012]** **Fotos, medidas corporales y registro de comidas.** Justificación: cobertura completa del
  seguimiento físico. Dificultad: media-alta (gestión de archivos/imágenes, almacenamiento).
- **[BL-013]** **Login web con huella/passkey (WebAuthn)** en vez de usuario/contraseña. Justificación:
  mejor experiencia desde el móvil (sin escribir contraseña) y mayor seguridad al no viajar
  ni almacenarse una contraseña en el servidor; viable porque Tailscale ya provee HTTPS con
  certificado válido, requisito de WebAuthn. Pospuesto explícitamente por David a una segunda
  iteración — el MVP usa login simple usuario/contraseña. Dificultad: media (requiere flujo de
  registro de passkey y verificación de firma criptográfica en servidor, más plan de fallback
  si se pierde el dispositivo).
- **[BL-014]** **Gamificación (logros)**: sistema de logros/hitos (ej. rachas de entrenamiento, récords
  personales de peso o volumen) para motivar el uso continuado. Justificación: propuesta por
  David como refuerzo de motivación. Pospuesto explícitamente a la iteración justo después del
  MVP, para diseñarlo con datos reales ya registrados. Dificultad: media (requiere definir
  catálogo de logros, lógica de detección y UI de visualización).
