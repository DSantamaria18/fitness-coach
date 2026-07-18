# Backlog

Features o defectos pendientes. Formato por entrada: descripción breve, justificación,
dificultad estimada (baja/media/alta). Cuando algo se implementa, se mueve de aquí a
[CHANGELOG.md](CHANGELOG.md).

## Pendiente de aprobación del usuario

- **Tests E2E con Playwright** cubriendo los flujos críticos de móvil (login, registrar peso,
  registrar sesión) una vez existan pantallas reales. Justificación: Vitest + Testing Library
  cubren lógica de dominio y componentes aislados, pero no verifican el flujo completo en un
  navegador real como lo usará David desde el móvil. Dificultad: baja-media (configuración
  estándar, pero exige mantener los tests al día con la UI).

- **Automatizar el backup manual actual** (subida periódica a almacenamiento externo, p.ej.
  Google Drive o Backblaze B2, en vez de depender de que David pulse "Descargar backup").
  Justificación: hoy el aviso de 30 días en `/ajustes` es la única red de seguridad (ver
  DECISIONS.md 2026-07-18); si en el futuro se quiere eliminar la dependencia de que alguien se
  acuerde, esto lo resolvería. Dificultad: media (requiere elegir proveedor, gestionar
  credenciales, y decidir el disparador — cron interno choca con el auto-stop de Fly.io free
  tier, así que probablemente un GitHub Actions programado contra un endpoint propio).

## Iteraciones futuras ya acordadas (no implementar todavía)

- **Integración con wearable** (pasos, sueño, frecuencia cardiaca). Justificación: ampliar el
  seguimiento más allá del entreno de fuerza. Dificultad: alta (depende de APIs externas de
  terceros, aún por decidir cuál).
- **Fotos, medidas corporales y registro de comidas.** Justificación: cobertura completa del
  seguimiento físico. Dificultad: media-alta (gestión de archivos/imágenes, almacenamiento).
- **Login web con huella/passkey (WebAuthn)** en vez de usuario/contraseña. Justificación:
  mejor experiencia desde el móvil (sin escribir contraseña) y mayor seguridad al no viajar
  ni almacenarse una contraseña en el servidor; viable porque Tailscale ya provee HTTPS con
  certificado válido, requisito de WebAuthn. Pospuesto explícitamente por David a una segunda
  iteración — el MVP usa login simple usuario/contraseña. Dificultad: media (requiere flujo de
  registro de passkey y verificación de firma criptográfica en servidor, más plan de fallback
  si se pierde el dispositivo).
- **Gamificación (logros)**: sistema de logros/hitos (ej. rachas de entrenamiento, récords
  personales de peso o volumen) para motivar el uso continuado. Justificación: propuesta por
  David como refuerzo de motivación. Pospuesto explícitamente a la iteración justo después del
  MVP, para diseñarlo con datos reales ya registrados. Dificultad: media (requiere definir
  catálogo de logros, lógica de detección y UI de visualización).
