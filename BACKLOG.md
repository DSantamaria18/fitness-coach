# Backlog

Features o defectos pendientes. Formato por entrada: descripción breve, justificación,
dificultad estimada (baja/media/alta). Cuando algo se implementa, se mueve de aquí a
[CHANGELOG.md](CHANGELOG.md).

## Pendiente de aprobación del usuario

- **Tests E2E con Playwright** cubriendo los flujos críticos de móvil (login, registrar peso,
  registrar sesión, y las dos generaciones asistidas por IA en `/sesion` y `/informe`).
  Justificación: Vitest + Testing Library cubren lógica de dominio y componentes aislados, pero
  no verifican el flujo completo en un navegador real como lo usará David desde el móvil.
  **Los flujos de IA deben interceptar/mockear la respuesta de `api.anthropic.com` (p. ej. con
  `page.route()` de Playwright) en vez de usar `ANTHROPIC_API_KEY` real** — ver DECISIONS.md
  2026-07-19 (ronda de generación asistida por IA): el bug de `buildInitialRegistros` (RSC) se
  detecta igual con una respuesta simulada, porque depende de cruzar la frontera servidor/
  cliente en cualquier éxito, no de que la respuesta sea real; un doble aquí no pierde
  cobertura y evita gasto real recurrente en cada ejecución de CI. Dificultad: baja-media
  (configuración estándar, pero exige mantener los tests al día con la UI).

- **Regla de lint (o script de CI) que impida importar un export de función desde un módulo
  `"use client"` en un módulo `"use server"`.** Justificación: el bug de
  `buildInitialRegistros` (Runtime Error 500 determinista en éxito de "Generar propuesta con
  IA", ver DECISIONS.md 2026-07-19) no lo detectó `npm test` — se verificó empíricamente que
  Vitest/jsdom no interpreta la directiva `"use client"` (solo lo hace el bundler de RSC de
  Next.js), así que una Server Action puede importar y llamar sin error aparente en tests a una
  función "de cliente" que sí crashea siempre en `next dev`/`next start` reales. Solo la
  verificación manual en navegador real lo encontró. Alguna combinación de
  `eslint-plugin-react-server-components` (o una regla `no-restricted-imports` ad-hoc por
  directorio) daría una señal en el propio editor/CI antes de llegar a QA. Dificultad: media
  (investigar si existe una regla de ESLint madura para esto en el ecosistema Next.js 16 actual,
  o escribir una regla custom sencilla basada en detectar la directiva del fichero importado).

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
- **Elegir rango de fechas (`desde`/`hasta`) desde la UI de `/informe`.** Justificación:
  `getProgressReport` ya soporta filtrar por rango de fechas, pero la pantalla actual solo
  expone el filtro por ejercicio — David no puede acotar el informe a, por ejemplo, "el último
  mes" sin editar la URL a mano. Nota: en cuanto exista este filtro, la nota de "racha" de la
  UI debería explicitar también que `currentStreakWeeks` ignora `hasta` y siempre cuenta hacia
  atrás desde hoy (ver DECISIONS.md 2026-07-18), porque ahí sí puede confundir que un rango
  pasado muestre racha 0. Dificultad: baja-media (controles de fecha + pasar los parámetros a
  `getProgressReport`, ya validados en la capa de dominio).
- **Comparar periodos en el informe de progreso** (p.ej. este mes vs. el anterior, o evolución
  año contra año). Justificación: hoy el informe solo muestra una serie temporal continua; una
  comparación directa ayudaría a ver progreso relativo sin tener que interpretar el gráfico a
  ojo. Dificultad: media (requiere decidir la UX de comparación y duplicar/alinear series en
  los gráficos existentes).
- **Exportar el informe de progreso** (PDF o imagen descargable) para compartirlo o archivarlo
  fuera de la app. Justificación: propuesta razonable dado que ya existe un flujo de exportar
  datos (backup manual desde `/ajustes`), pero para el informe visual, no el fichero SQLite
  completo. Dificultad: media (generación de PDF/imagen en servidor o cliente, sin librería ya
  elegida en el stack).

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
