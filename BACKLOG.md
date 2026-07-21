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

- **[BL-019]** **Rediseño de UX**: reorganizar la navegación y los flujos entre las secciones
  existentes (`/sesion`, `/historial`, `/peso`, `/informe`, `/ajustes`), no solo un pulido visual.
  Justificación: la navegación actual (barra plana en `nav-bar.tsx`) se pensó para un puñado de
  páginas; a medida que crecen las funcionalidades (catálogo de ejercicios, informes, futuras
  iteraciones 2/3 de wearables/fotos/comidas) puede quedarse corta o confusa. Dificultad: media
  (requiere antes una propuesta de nueva estructura de navegación/flujos a validar con David,
  más el trabajo de implementación en sí — no se aborda sin una fase de diseño previa acordada).

- **[BL-020]** **Actualizar `actions/checkout` y `actions/setup-node` de v4 a v5** en todos los
  workflows de GitHub Actions (`ci.yml` y `seed-prod.yml`). Justificación: GitHub avisa de que v4
  targetea una versión de Node deprecada (detectado por TechOps al validar la primera ejecución
  real de `seed-prod.yml`, 2026-07-21); no rompe nada hoy, es mantenimiento de rutina. Dificultad:
  baja (cambio mecánico de versión en los workflows existentes, verificar que el CI sigue en
  verde tras el bump).

## Iteraciones futuras ya acordadas (no implementar todavía)

- **[BL-011]** **Integración con wearable** (pasos, sueño, frecuencia cardiaca). Justificación: ampliar el
  seguimiento más allá del entreno de fuerza. Dificultad: alta (depende de APIs externas de
  terceros, aún por decidir cuál).
- **[BL-012]** **Fotos, medidas corporales y registro de comidas.** Justificación: cobertura completa del
  seguimiento físico. Dificultad: media-alta (gestión de archivos/imágenes, almacenamiento).
- **[BL-013]** **Login web con huella/passkey (WebAuthn)** en vez de usuario/contraseña. Justificación:
  mejor experiencia desde el móvil (sin escribir contraseña) y mayor seguridad al no viajar
  ni almacenarse una contraseña en el servidor; viable porque Vercel ya provee HTTPS con
  certificado válido automáticamente, requisito de WebAuthn (antes se asumía vía Tailscale, ver
  DECISIONS.md 2026-07-20). Pospuesto explícitamente por David a una segunda
  iteración — el MVP usa login simple usuario/contraseña. Dificultad: media (requiere flujo de
  registro de passkey y verificación de firma criptográfica en servidor, más plan de fallback
  si se pierde el dispositivo).
- **[BL-014]** **Gamificación (logros)**: sistema de logros/hitos (ej. rachas de entrenamiento, récords
  personales de peso o volumen) para motivar el uso continuado. Justificación: propuesta por
  David como refuerzo de motivación. Dificultad: media (requiere definir catálogo de logros,
  lógica de detección y UI de visualización). Diseño ya cerrado en conversación (2026-07-21, sin
  llegar a implementarse): 4 categorías de logro (rachas de constancia reutilizando
  `currentStreakWeeks`, PRs de peso/volumen por ejercicio, hitos de volumen acumulado, hitos de
  variedad), tabla `UnlockedAchievement` (sin `@unique` en BD — los logros de una vez se protegen
  por lógica de aplicación, los PRs son repetibles por diseño), logros permanentes (no se
  revocan al editar/borrar datos), detección best-effort enganchada a `createSession`/
  `createBodyWeight`, página propia `/logros` con criterios visibles también para lo bloqueado.
  Pospuesto explícitamente por David dos veces: primero a la iteración justo después del MVP
  para diseñarlo con datos reales ya registrados, y ahora (2026-07-21) explícitamente a **después**
  de completar el rediseño de UX (ver [BL-019]) y de acumular más datos reales de uso — no
  retomar antes de que ambas condiciones se cumplan.
