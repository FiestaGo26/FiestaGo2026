# Clips base del avatar

Esta carpeta contiene el metraje **real** que sirve de base para tus vídeos
avatar. El pipeline (`avatar-video.mjs`) no cambia tu cara ni tu cuerpo — solo
sustituye la boca (lipsync) y el audio (voz clonada) para que digas un guion
nuevo. Por eso la calidad de estos clips es lo que más determina si el
resultado se nota "IA" o no.

Los archivos de esta carpeta **no se suben al repo** (están en `.gitignore`),
porque es tu imagen y tu voz — quédatelos en local.

## Cómo grabar

- **Vertical 9:16**, buena luz de frente (ventana o luz suave, sin
  contraluz), fondo neutro y estable
- Mírate directo al objetivo, como si le hablases a un amigo, no leyendo
  un teleprompter
- **15-30 segundos por clip.** Cuanto más largo, menos se nota el loop
  cuando un guion es más largo que el clip (Sync Labs repite el clip si
  hace falta)
- Habla de verdad durante la grabación (da igual el contenido — el audio se
  sustituye) para que la boca, cejas y micro-gestos se muevan de forma
  natural. No hace falta memorizar nada
- Parpadea con normalidad, deja pausas, muévete un poco (no te quedes
  rígido) — la naturalidad del movimiento de cabeza/cuerpo es 100% tuya y
  no se toca, así que cuanto más natural grabes, más natural queda siempre

## Nomenclatura

Nombra los archivos con el prefijo del "mood" que usan las plantillas de
`post-templates.json` (campo `avatar_mood`), seguido de un guion:

```
neutral-1.mp4
neutral-2.mp4
energetic-1.mp4
serious-1.mp4
```

Si no hay ningún clip con el prefijo pedido, el pipeline coge cualquiera
de la carpeta. Con 1 clip por mood ya funciona; con 3-4 por mood el
contenido se ve menos repetitivo entre posts.

## Mínimo para empezar

Basta con **un solo clip** de ~20s hablando en tono neutral
(`neutral-1.mp4`) para probar el pipeline end-to-end. Añade variedad
(otros moods, otros ángulos/planos) según vayas publicando más.
