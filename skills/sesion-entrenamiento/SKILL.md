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

## Perfil y contexto

- Hombre, 47 años, ~82 kg, objetivo ~75 kg, sin lesiones ni condiciones médicas.
- Nivel entre principiante e intermedio; base deportiva de fondo en natación, waterpolo y kickboxing,
  además de etapas irregulares de gimnasio.
- Material disponible: mancuernas de máximo 10 kg por mano, banco de abdominales, esterilla, agarres/
  paralelas para flexiones en el suelo, y cinta de correr con inclinación regulable. Sin barra,
  kettlebells ni máquinas — no propongas ejercicios que requieran material que no tiene.
## Rotación de sesiones

Cuatro tipos, en este orden cíclico: **Fuerza 1 → Cardio → Fuerza 2 → Activo → (vuelta a Fuerza 1)**.

- **Fuerza 1 / Fuerza 2**: pecho, dorsal, hombro, brazo y sentadillas. Como el peso está limitado a
  10 kg, compensa la intensidad con tempo lento (3-4 seg de fase excéntrica) o pausas isométricas, no
  solo subiendo peso. Fuerza 1 y Fuerza 2 trabajan los mismos grupos musculares pero deben sentirse
  distintas entre sí en la selección de ejercicios.
- **Cardio**: cinta (calentamiento + intervalos) + burpees al fallo al final.
- **Activo**: surf si hay olas, o si no, una sesión mixta de fuerza suave + cardio.
## Cómo decidir qué toca hoy

1. Lee el archivo de historial (ver "Archivo de estado" más abajo).
2. Si no existe o está vacío, hoy toca **Fuerza 1**; créalo después de generar la sesión.
3. Si existe, mira el tipo de la última sesión registrada y avanza al siguiente de la rotación.
4. Si David pide explícitamente otro tipo de sesión ("hoy quiero cardio", "hazme piernas distinto a
   lo que tocara"), genera esa sesión en su lugar. Es un caso especial: no preguntes por qué, solo
   regístrala con su tipo real para que la rotación futura siga desde ahí correctamente.
No le preguntes a David qué tipo de sesión toca salvo que el historial sea ambiguo, esté corrupto, o
directamente no exista ninguna forma de inferirlo — esa pregunta es justo la fricción que esta skill
existe para quitarle de encima.

## Reglas de variedad

No repitas el ejercicio principal de un grupo muscular si ya apareció en las 2 sesiones anteriores del
mismo tipo (compara Fuerza 1 con Fuerza 1, Fuerza 2 con Fuerza 2, no entre sí). Varía también el orden
y los ejercicios accesorios/complementarios aunque el grupo muscular sea el mismo. El objetivo es que
David nunca sienta que le repites la sesión de la semana pasada.

## Reglas de peso y progresión

- Si un ejercicio no tiene historial previo (o es la primera vez que se usa este tipo de sesión),
  propón un peso orientativo según su nivel (principiante-intermedio) y dilo explícitamente: "peso
  orientativo, ajústalo según tus sensaciones".
- Si ese ejercicio, o uno que trabaje el mismo grupo muscular, sí aparece en el historial con peso y
  RPE registrados, ajusta el peso de esta sesión según ese dato: RPE bajo (≤6) sugiere subir peso o
  repeticiones, RPE alto (≥9) sugiere mantener o bajar.
- Cuando David tenga su app de seguimiento conectada, es probable que te pase esos datos de peso/RPE
  directamente en la conversación en vez de que los leas del historial local — en ese caso, trata lo
  que él te diga como la fuente de verdad, por encima de lo que haya en el archivo.
## Archivo de estado

Guarda y lee el historial en `entrenamiento-historial.json`, en el directorio de trabajo actual.
Estructura:

```json
{
  "sessions": [
    {
      "date": "2026-07-16",
      "type": "fuerza1",
      "override": false,
      "exercises": [
        {
          "name": "Press pecho mancuernas",
          "series": 4,
          "reps": 10,
          "tempo": "3-1-1",
          "weight_kg": 10,
          "rpe_reported": null
        }
      ]
    }
  ]
}
```

Si el archivo no existe al arrancar, créalo justo después de generar la primera sesión. Después de
generar cada sesión nueva, añade su entrada al final de `sessions`. Si David te reporta a posteriori
el peso real usado o el RPE de una sesión pasada, actualiza esa entrada existente en vez de crear una
nueva.

## Formato de salida

Entrega siempre una tabla con estas columnas exactas: **Ejercicio | Series | Reps | Tempo | Peso**.
No añadas teoría de entrenamiento ni explicaciones largas salvo que David las pida explícitamente —
quiere la sesión lista para hacer, no una clase.
