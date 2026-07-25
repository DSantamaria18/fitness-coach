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

- **[BL-021]** **Bot de Telegram como canal adicional de entrada/salida**: poder registrar peso
  corporal y sesiones de entreno, y consultar el informe de progreso, conversando con un bot de
  Telegram — además de la webapp, no en sustitución de ella. Justificación: canal más rápido e
  inmediato desde el móvil (sin abrir navegador) para registrar datos justo al acabar el entreno,
  propuesto por David. Dificultad: alta (requiere integrar la Telegram Bot API vía webhook con
  endpoint público, autenticar que el chat es el de David y no de un tercero, interpretar mensajes
  en lenguaje natural reutilizando la misma lógica de generación asistida por IA ya construida
  para `/sesion`, y decidir qué acciones expone el bot reutilizando las Server Actions/el servidor
  MCP ya existentes en vez de duplicar lógica de negocio).

- **[BL-022]** **Adaptar los campos de registro de cardio por ejercicio**: hoy el formulario de
  cardio muestra los mismos 10 campos fijos (duración, distancia, velocidad media, ritmo medio,
  FC media, FC máxima, pasos, cadencia, kcal, RPE) para cualquier ejercicio CARDIO — para
  "Natación" aparecen Pasos/Cadencia sin sentido, para "Surf" casi todos son irrelevantes salvo
  duración. Justificación: detectado al valorar el ajuste real de la app al caso de uso de David
  (2026-07-21); empeorará según crece la variedad de cardio (Escaladores, Jumping jacks, Rodillas
  altas, Burpees, Surf). Dificultad: media (definir qué campos aplican por ejercicio/categoría y
  adaptar `CARDIO_FIELDS` en `session-entries-editor.tsx`, posiblemente añadiendo metadata al
  modelo `Exercise`).
- **[BL-023]** **Documentar/forzar una convención explícita de series unilaterales vs.
  bilaterales**: ni el esquema (`Exercise`/`StrengthSet`), ni la UI, ni la skill distinguen hoy
  ejercicios unilaterales (Sentadilla búlgara, Remo a un brazo, Puente de glúteos a una pierna) de
  bilaterales — "Series" no tiene semántica definida de "por lado" o "total", queda a
  interpretación libre en cada registro. Justificación: mismo análisis de ajuste al caso de uso
  (2026-07-21). Dificultad: baja-media (puede resolverse solo documentando la convención en
  `SKILL.md`/README, o subir a un campo explícito en `Exercise` si se quiere forzar en el
  esquema).

- **[BL-028]** **Chat con IA sobre temas diversos**: conversar libremente con la IA sobre dudas de
  un ejercicio concreto, feedback específico de una sesión ya registrada, evolución a lo largo
  del tiempo, etc. — más allá del flujo estructurado actual de generar/registrar sesión.
  Justificación: propuesto por David; hoy la única interacción con la IA es la skill de generación
  de sesión, sin un canal para preguntas abiertas que aprovechen el historial ya almacenado.
  Dificultad: alta (requiere diseñar una interfaz de chat, decidir qué contexto/historial se le
  inyecta a la IA en cada conversación y con qué límites, y previsiblemente llamadas de pago a la
  API de Claude — el modelo a usar se fija explícitamente en el encargo cuando se aborde, según
  regla ya acordada del equipo).

- **[BL-029]** **Vídeo o GIF animado explicando la ejecución de cada ejercicio**, al estilo de
  lyfta.app. Justificación: propuesto por David; ayuda a recordar la técnica correcta de
  ejercicios menos frecuentes sin depender de la memoria o de buscar fuera de la app. Dificultad:
  alta (requiere decidir la fuente del contenido — grabación propia, licencia de terceros, o
  generación por IA —, almacenamiento de vídeo/GIF por ejercicio del catálogo, y el coste que
  implique según la fuente elegida).

- **[BL-030]** **`NavBar` aparece en `/login` si ya hay sesión activa**: `NavBarGate` solo
  comprueba si existe sesión (`auth()`), no si la ruta es `/login` — si el navegador conserva una
  sesión válida y se visita `/login` directamente, se ve la barra de navegación (franja superior +
  pestañas inferior) superpuesta al formulario de login. Justificación: detectado por el Tech Lead
  al verificar en navegador real la integración de BL-019 (2026-07-25); no es un fallo de
  seguridad (la sesión sigue siendo válida, no hay bypass de autenticación), solo una
  inconsistencia visual menor, preexistente a BL-019 (no la introdujo el rediseño de navegación).
  Dificultad: baja (añadir una comprobación de ruta en `NavBarGate`, o redirigir `/login` a la
  primera sección si ya hay sesión).

## Iteraciones futuras ya acordadas (no implementar todavía)

- **[BL-011]** **Integración con wearable** (pasos, sueño, frecuencia cardiaca). Justificación: ampliar el
  seguimiento más allá del entreno de fuerza. La app de la pulsera de David ya exporta
  diariamente a una hoja de cálculo en Google Drive, lo que simplifica el enfoque: en vez de
  integrar contra la API propietaria del fabricante (OAuth por vendor, descubrir endpoints),
  basta con leer esa hoja vía Google Sheets API (autenticación con service account, sin login
  interactivo) e importar periódicamente (mismo patrón cron de GitHub Actions que
  `seed-prod.yml`). Dificultad: baja-media (definir el mapeo de columnas de la hoja al esquema,
  idempotencia del import por fecha para no duplicar filas al re-ejecutar).
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
