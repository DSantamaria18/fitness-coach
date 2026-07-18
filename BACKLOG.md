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

- **Añadir la capa VPN Tailscale al servidor MCP.** Justificación: el servidor MCP (en
  construcción, ver DECISIONS.md 2026-07-18) se despliega por ahora protegido solo por token
  Bearer, sin la segunda capa de VPN que especifica SPEC.md §7 — decisión consciente para no
  bloquear el desarrollo en Fly.io mientras el NAS propio de David no esté montado. Hay que
  volver a esto en cuanto el NAS con Tailscale esté disponible. Dificultad: baja (es
  configuración de red del despliegue, no cambia el código del servidor MCP).
- **UI web de historial y edición de sesiones de entreno** (paridad con `/historial`, que hoy
  solo cubre peso corporal). Justificación: la capa de dominio (`get-session-history.ts`,
  `update-session.ts`) ya existe desde esta ronda pensada para el servidor MCP, pero no hay
  ninguna pantalla web que la use — el criterio de aceptación del SPEC §13 ("editar o borrar
  cualquier registro existente, peso o sesión") no está cubierto en la web para sesiones
  todavía. Dificultad: baja-media (reutiliza la capa de dominio ya hecha y testeada, patrón
  similar a `/historial`).
- **Explicar bien la "racha" en la futura UI de informe de progreso.** Justificación:
  `get-progress-report.ts` calcula `currentStreakWeeks` siempre respecto a la semana real actual
  (ignora el filtro `hasta`), así que si se consulta un rango de fechas pasado, la racha puede
  salir 0 aunque haya una racha larga dentro de ese rango — comportamiento intencionado (ver
  DECISIONS.md 2026-07-18) pero potencialmente confuso sin una nota en la interfaz. Dificultad:
  baja (es una aclaración de copy/UI cuando se construya la pantalla, no un cambio de lógica).

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
