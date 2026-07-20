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

- **[BL-010]** **Breadcrumbs o indicador de sección dentro de cada página.** Justificación: la navegación
  global resalta la ruta activa en la propia barra fija, pero puede no ser obvio en qué sección
  está el usuario sin mirar arriba (p. ej. tras recargar la página o llegar desde un enlace
  externo). Dificultad: baja (es un indicador adicional en cada página, no cambia la
  navegación en sí).

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
