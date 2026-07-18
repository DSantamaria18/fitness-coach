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
- **Explicar bien la "racha" en la futura UI de informe de progreso.** Justificación:
  `get-progress-report.ts` calcula `currentStreakWeeks` siempre respecto a la semana real actual
  (ignora el filtro `hasta`), así que si se consulta un rango de fechas pasado, la racha puede
  salir 0 aunque haya una racha larga dentro de ese rango — comportamiento intencionado (ver
  DECISIONS.md 2026-07-18) pero potencialmente confuso sin una nota en la interfaz. Dificultad:
  baja (es una aclaración de copy/UI cuando se construya la pantalla, no un cambio de lógica).
- **Orden de intercalado entre ejercicios de fuerza y cardio no se conserva al editar una
  sesión.** Justificación: `StrengthEntry` tiene un campo `order`, pero `CardioEntry` no —
  `update-session.ts` (capa de dominio ya existente antes de esta ronda) reconstruye el orden de
  fuerza a partir de la posición en el array de ejercicios recibido, pero no hay forma de saber
  en qué posición relativa iba cada `CardioEntry` respecto a los de fuerza. El nuevo formulario
  de edición en `/historial` (`SessionEntriesEditor`) por tanto lista primero todos los
  ejercicios de fuerza de la sesión y después todos los de cardio al pre-rellenar el formulario;
  si se guarda sin tocar nada, una sesión que originalmente intercalaba cardio-fuerza-cardio
  puede terminar reordenada a fuerza-cardio-cardio. No hay pérdida de datos (se conservan todos
  los ejercicios con sus series/métricas), solo un reordenamiento visual. Arreglarlo exige un
  campo `order` en `CardioEntry` (migración de esquema) y tocar `resolveSessionEntries`. Nivel
  de riesgo bajo (nadie ha registrado sesiones reales todavía), pero lo anoto para no perderlo.
  Dificultad: media (migración de esquema + lógica de resolución de entradas).

- **Botón de cerrar sesión visible en la interfaz.** Justificación: hoy no existe ningún punto
  de la UI desde el que cerrar sesión (`signOut` de Auth.js está exportado en `src/auth.ts`
  pero no se usa en ningún componente) — la única forma de salir es borrar la cookie a mano.
  Detectado al implementar la navegación global (`feature/nav-global`): encajaría de forma
  natural como un elemento más de la barra de navegación, pero dónde colocarlo y si pedir
  confirmación antes de cerrar sesión son decisiones de producto, así que lo dejo para que las
  apruebe David en vez de añadirlo por mi cuenta. Dificultad: baja (Server Action que llama a
  `signOut()`).

- **Menú hamburguesa o navegación colapsable para cuando crezca el número de secciones.**
  Justificación: la barra de navegación actual (`feature/nav-global`) reparte 5 enlaces en una
  fila horizontal a partes iguales, que ya queda ajustada en pantallas de móvil pequeñas; si se
  añaden más secciones en iteraciones futuras (wearable, fotos/medidas, comidas) dejará de
  caber sin reducir demasiado el texto de cada enlace. Dificultad: media (patrón de menú
  desplegable, gestión de estado abierto/cerrado y accesibilidad de foco).

- **Breadcrumbs o indicador de sección dentro de cada página.** Justificación: la navegación
  global resalta la ruta activa en la propia barra fija, pero puede no ser obvio en qué sección
  está el usuario sin mirar arriba (p. ej. tras recargar la página o llegar desde un enlace
  externo). Dificultad: baja (es un indicador adicional en cada página, no cambia la
  navegación en sí).

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
