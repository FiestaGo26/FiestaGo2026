// Guion del vídeo "Mi negocio lo dirige un CEO de IA" · estilo TikTok
// explicativo: checklist de 5 pasos que se va marcando, tarjetas de UI
// animadas y subtítulos con la palabra clave resaltada.
//
// En `caption`, lo que va entre *asteriscos* sale resaltado en violeta.
// `step` = qué paso del checklist está activo en esa escena (0 = ninguno).
// El voiceover tiene que mantenerse en el mismo orden que las escenas;
// las duraciones están calculadas a ~14 caracteres/segundo de locución.

export type CeoCard = 'kpi' | 'checklist' | 'chat' | 'metrics' | 'tasks' | 'routines' | 'rule' | 'inbox' | 'cta'

export type CeoScene = {
  caption:  string
  card:     CeoCard
  step:     number
  duration: number   // segundos
}

export const CEO_STEPS = [
  'Agente con rol de CEO',
  'Dale el contexto',
  'Dale su lista de tareas',
  'Programa sus rutinas',
  'La regla de oro',
]

export const CEO_SCRIPT = {
  slug: 'ceo-agente-ia',
  title: 'Mi negocio lo dirige un CEO de IA',
  voiceover:
    'Mi negocio tiene un CEO que trabaja todos los días a las ocho menos ocho. Y no es una persona. ' +
    'Es un agente de inteligencia artificial, y te enseño cómo lo he montado en cinco pasos. ' +
    'Uno: crea un agente y dale el rol de CEO. Le digo: eres el CEO de Fiestago, y me reportas a mí. ' +
    'Dos: dale contexto real. Se conecta a la base de datos y ve proveedores, reservas, la lista de espera y las alertas. ' +
    'Tres: dale su lista de tareas. Monetizar, captar proveedores, SEO, newsletter y vigilar los bugs. ' +
    'Cuatro: prográmale rutinas. Un parte cada mañana y un informe completo cada lunes. ' +
    'Y cinco, la regla de oro: antes de que salga nada a la gente, me pregunta primero. ' +
    'Así que cada mañana me llega esto: lo que ha pasado, qué falla, y tres propuestas que apruebo con un clic. ' +
    'Si quieres que te monte uno para tu negocio, escríbeme. Esto es Fiestago.',
  scenes: [
    { caption: 'Mi negocio tiene un *CEO*… y no es una persona', card: 'kpi',       step: 0, duration: 5.2 },
    { caption: 'Es un *agente de IA* · 5 pasos',                card: 'checklist', step: 0, duration: 5.8 },
    { caption: 'Dale el rol de *CEO*',                          card: 'chat',      step: 1, duration: 6.4 },
    { caption: 'Contexto *real*: tu base de datos',            card: 'metrics',   step: 2, duration: 7.6 },
    { caption: 'Su *lista de tareas*',                          card: 'tasks',     step: 3, duration: 6.6 },
    { caption: 'Rutinas: *cada mañana* y cada lunes',          card: 'routines',  step: 4, duration: 5.6 },
    { caption: 'Antes de que salga nada, *te pregunta*',        card: 'rule',      step: 5, duration: 6.0 },
    { caption: '3 propuestas · *apruebas con un clic*',         card: 'inbox',     step: 6, duration: 7.4 },
    { caption: '¿Te monto uno? *Escríbeme*',                    card: 'cta',       step: 6, duration: 5.4 },
  ] as CeoScene[],
}

export function ceoDuration() {
  return CEO_SCRIPT.scenes.reduce((s, sc) => s + sc.duration, 0)
}
