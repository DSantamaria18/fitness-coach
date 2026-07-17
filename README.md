# Fitness Coach

Webapp personal de seguimiento de fitness para uso individual (David). Sirve como fuente de
verdad del historial de entrenamiento (peso corporal, series, reps, tempo, RPE por ejercicio),
sustituyendo al archivo JSON local que hoy usa la skill de Claude "sesion-entrenamiento". La
app debe poder conectarse a la cuenta de Claude del usuario para que esa skill (u otros chats)
lean y escriban datos directamente.

> Estado: en fase de especificación. Aún no hay stack técnico ni código definidos.

## Alcance por iteraciones

- **Iteración 1 (MVP, en curso):** registro de peso corporal y de sesiones de entreno
  (ejercicio, series, reps, tempo, peso, RPE), con conexión hacia la cuenta de Claude del
  usuario.
- **Iteración 2 (futura):** integración con datos de pulsera/wearable (pasos, sueño,
  frecuencia cardiaca).
- **Iteración 3 (futura):** fotos, medidas corporales, registro de comidas.

## Documentación del proyecto

- [BACKLOG.md](BACKLOG.md) — features/defectos pendientes y propuestas de mejora.
- [CHANGELOG.md](CHANGELOG.md) — cambios por versión.
- [FEATURES.md](FEATURES.md) — funcionalidades ya implementadas.
- [DECISIONS.md](DECISIONS.md) — decisiones de diseño/arquitectura y lecciones aprendidas.
- [ARCHITECTURE.md](ARCHITECTURE.md) — arquitectura de la aplicación.
