---
name: sesion-entrenamiento
description: >
  Genera la sesión de entrenamiento del día para David: ejercicios, series, repeticiones, tempo
  y peso, en una tabla lista para ejecutar. Determina automáticamente qué tipo de sesión toca
  (Fuerza 1, Cardio, Fuerza 2, Activo) leyendo el historial de sesiones registrado, sin que David
  tenga que especificarlo cada vez, y solo se desvía de la rotación si David pide explícitamente
  otra cosa. Usa esta skill siempre que David pida su entreno de hoy, diga "dame mi sesión", "qué
  toca hoy", "entreno", "sesión de fuerza/cardio/piernas/activo", quiera variar ejercicios de pesas
  porque le aburren los repetidos, o mencione cualquier aspecto de planificar o generar su rutina
  diaria de gimnasio.
---

# Sesión de entrenamiento — David

## Por qué existe esta skill

David se aburre si repite siempre los mismos ejercicios de pesas, así que cada sesión debe variar
respecto a las anteriores del mismo tipo. Además, no quiere tener que decirte cada vez qué tipo de
sesión toca hoy: se apoya en la rotación y en el historial registrado para que tú lo decidas, y solo
interviene cuando quiere algo especial.

## Requisito: conector MCP de fitness-coach

Esta skill depende de las tools del servidor MCP de la app **fitness-coach**
(`list_exercises`, `get_session_history`, `log_session`, `edit_session`) como única fuente de
verdad del catálogo de ejercicios y del historial de sesiones. No existe ningún archivo local
de respaldo.

Si al arrancar detectas que esas tools no están disponibles en la sesión actual de Claude
Code, dilo explícitamente a David y **no generes ninguna sesión** sin poder consultar antes su
catálogo e historial reales — nada de fallback silencioso ni de inventar la sesión con
supuestos genéricos. Usa un mensaje similar a: "Necesito el conector MCP de fitness-coach
conectado para generar tu sesión — conéctalo con `claude mcp add ...` (ver README.md del
proyecto para el comando exacto) y vuelve a intentarlo."

## Perfil y contexto

- Hombre, 47 años, ~82 kg, objetivo ~75 kg, sin lesiones ni condiciones médicas.
- Nivel entre principiante e intermedio; base deportiva de fondo en natación, waterpolo y kickboxing,
  además de etapas irregulares de gimnasio.
- Material disponible: mancuernas de máximo 10 kg por mano, banco de abdominales, esterilla, agarres/
  paralelas para flexiones en el suelo, y cinta de correr con inclinación regulable. Sin barra,
  kettlebells ni máquinas — no propongas ejercicios que requieran material que no tiene.

## Catálogo de ejercicios

Antes de elegir los ejercicios de la sesión, consulta `list_exercises` para traer el catálogo
cerrado real de la app. Los nombres que devuelve esa tool son los **únicos** válidos: nunca
propongas un ejercicio que no esté en esa lista, aunque encaje conceptualmente con el material
disponible o con el grupo muscular que toca. Si el catálogo no cubre bien un hueco que
necesitarías (p. ej. no hay ningún ejercicio de un grupo muscular concreto con el material que
David tiene), elige la alternativa más cercana ya existente en el catálogo y coméntaselo a
David en vez de inventar un ejercicio nuevo — hoy no puedes darlo de alta tú mismo en la app.

## Rotación de sesiones

Cuatro tipos, en este orden cíclico: **Fuerza 1 → Cardio → Fuerza 2 → Activo → (vuelta a Fuerza 1)**.

- **Fuerza 1 / Fuerza 2**: pecho, dorsal, hombro, brazo y sentadillas. Como el peso está limitado a
  10 kg, compensa la intensidad con tempo lento (3-4 seg de fase excéntrica) o pausas isométricas, no
  solo subiendo peso. Fuerza 1 y Fuerza 2 trabajan los mismos grupos musculares pero deben sentirse
  distintas entre sí en la selección de ejercicios.
- **Cardio**: cinta (calentamiento + intervalos) + burpees al fallo al final.
- **Activo**: surf si hay olas, o si no, una sesión mixta de fuerza suave + cardio.
## Cómo decidir qué toca hoy

1. Consulta `get_session_history` para traer el historial real de sesiones registradas.
2. Si no hay ninguna sesión registrada, hoy toca **Fuerza 1**.
3. Si hay sesiones, mira el tipo de la última registrada y avanza al siguiente de la rotación.
4. Si David pide explícitamente otro tipo de sesión ("hoy quiero cardio", "hazme piernas distinto a
   lo que tocara"), genera esa sesión en su lugar. Es un caso especial: no preguntes por qué, solo
   regístrala con su tipo real (con `log_session`, ver "Cómo registrar la sesión" más abajo) para
   que la rotación futura siga desde ahí correctamente.
No le preguntes a David qué tipo de sesión toca salvo que el historial sea ambiguo, esté corrupto, o
directamente no exista ninguna forma de inferirlo — esa pregunta es justo la fricción que esta skill
existe para quitarle de encima.

## Reglas de variedad

No repitas el ejercicio principal de un grupo muscular si ya apareció en las 2 sesiones anteriores del
mismo tipo (compara Fuerza 1 con Fuerza 1, Fuerza 2 con Fuerza 2, no entre sí). Varía también el orden
y los ejercicios accesorios/complementarios aunque el grupo muscular sea el mismo. El objetivo es que
David nunca sienta que le repites la sesión de la semana pasada.

## Reglas de peso y progresión

- Si el ejercicio es a peso corporal (sin carga externa — p. ej. Burpees, Dominadas, Flexiones,
  Plancha, y cualquier otro que conceptualmente no use mancuernas ni lastre), no propongas ningún
  peso orientativo ni escribas ningún número: indícalo como "a peso corporal" (o equivalente) y
  deja el campo de peso sin informar al registrar la sesión con `log_session`/`edit_session`. Esta
  excepción tiene prioridad sobre las dos reglas siguientes, aunque el ejercicio no tenga
  historial previo.
- Si un ejercicio con carga externa (mancuernas) no tiene historial previo (o es la primera vez
  que se usa este tipo de sesión), propón un peso orientativo según su nivel
  (principiante-intermedio) y dilo explícitamente: "peso orientativo, ajústalo según tus
  sensaciones".
- Si ese ejercicio, o uno que trabaje el mismo grupo muscular, sí aparece en el historial con peso y
  RPE registrados, ajusta el peso de esta sesión según ese dato: RPE bajo (≤6) sugiere subir peso o
  repeticiones, RPE alto (≥9) sugiere mantener o bajar.
- Si David te menciona en la propia conversación el peso o RPE reales de una sesión que ya generaste
  (en vez de dejar que lo saques de `get_session_history`), trata lo que él te diga como la fuente
  de verdad por encima de lo que haya registrado, y aplica la corrección con `edit_session` (ver
  "Cómo registrar la sesión" más abajo).

## Cómo registrar la sesión

Usa `get_session_history` para consultar el historial (fecha, tipo, ejercicios con sus series,
reps, tempo, peso y RPE) siempre que necesites decidir la rotación o aplicar la regla de
variedad o de progresión — es la única fuente de historial, no una entre varias.

En cuanto termines de presentar la sesión de hoy a David en la tabla de salida, regístrala de
inmediato con `log_session` (mismo esquema: ejercicio, series, reps, tempo, peso, RPE). No
esperes a que David la confirme explícitamente ni la dejes sin registrar para una respuesta
posterior — cada sesión generada se persiste en el acto.

Si David te reporta a posteriori el peso real usado o el RPE de una sesión pasada (o pide corregir
cualquier otro dato de una sesión ya registrada), usa `edit_session` para sustituir esa entrada
existente por los datos corregidos, en vez de crear una sesión nueva.

## Formato de salida

Entrega siempre una tabla con estas columnas exactas: **Ejercicio | Series | Reps | Tempo | Peso**.
No añadas teoría de entrenamiento ni explicaciones largas salvo que David las pida explícitamente —
quiere la sesión lista para hacer, no una clase.
