# Backlog

Features o defectos pendientes. Formato por entrada: descripción breve, justificación,
dificultad estimada (baja/media/alta). Cuando algo se implementa, se mueve de aquí a
[CHANGELOG.md](CHANGELOG.md).

## Pendiente de aprobación del usuario

_(vacío por ahora — se irán añadiendo propuestas de mejora a medida que avance el proyecto,
sin implementarlas hasta que David las apruebe explícitamente.)_

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
