// ───────────────────────────────────────────────────────────────────────
// Planner de contenido diario para redes sociales (Reels/TikTok/Shorts).
// Rota entre 7 pilares (uno por día de la semana) y dentro de cada pilar
// hay una bolsa de temas para que el guion no se repita.
//
// El guion final lo redacta Claude con prompt especializado en copy de
// vídeo vertical 30s: hook fuerte 3s + cuerpo + CTA.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { countPlazasConSelloRestantes } from '@/lib/fiestago-agent'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = new Anthropic()
  return _client
}

export type Pillar = {
  id:           string
  dayOfWeek:    0 | 1 | 2 | 3 | 4 | 5 | 6   // 0=domingo
  label:        string
  topicBag:     string[]
  ctaUrl:       string
  ctaShort:     string                       // 3-4 palabras que el avatar dice al final
  hashtagsBase: string[]
}

// Pilares por día. dayOfWeek sigue convención JS (0=domingo, 1=lunes,…).
export const PILLARS: Pillar[] = [
  {
    id:        'lunes_tip',
    dayOfWeek: 1,
    label:     'Tip de planificación',
    topicBag: [
      'Los 3 errores más caros al elegir banquete',
      'Cuánto reservar para imprevistos en el presupuesto',
      'Cuándo cerrar fecha del salón sin perder dinero',
      'Por qué la lista de invitados se desmadra siempre',
      'El error de elegir fotógrafo solo por precio',
      'Cómo decidir entre comida o barra libre',
      'Cuánto antes contratar al DJ',
      'La trampa de los "presupuestos cerrados"',
    ],
    ctaUrl:       'https://fiestago.es/calculadora',
    ctaShort:     'calcula tu boda gratis',
    hashtagsBase: ['bodas','bodasespaña','planificarboda','tipsbodas','noviosencantados'],
  },
  {
    id:        'martes_categoria',
    dayOfWeek: 2,
    label:     'Categoría destacada',
    topicBag: [
      'Por qué un buen DJ vale más que el cóctel',
      'El catering bueno se nota a los 10 minutos',
      'Lo que diferencia a un fotógrafo de boda de uno cualquiera',
      'Floristería de bodas: por qué el precio cambia tanto',
      'Tartas de boda: cuándo el diseño importa más que el sabor',
      'Animación: el detalle que vuelve a la gente loca',
      'Espacios para bodas: qué preguntar antes de firmar',
      'Wedding planner: cuándo merece la pena pagarlo',
    ],
    ctaUrl:       'https://fiestago.es/marketplace',
    ctaShort:     'búscalos en FiestaGo',
    hashtagsBase: ['proveedoresboda','fotografodebodas','djbodas','cateringbodas','floristabodas'],
  },
  {
    id:        'miercoles_garantia',
    dayOfWeek: 3,
    label:     'Garantía de Éxito',
    topicBag: [
      'Si tu proveedor cancela 2 días antes, qué pasa',
      'Cómo recuperas tu dinero si el espacio cierra',
      'El 8% que paga el cliente, qué cubre exactamente',
      'Por qué pagar en escrow protege a las dos partes',
      'La diferencia entre una agencia y un marketplace con garantía',
      'Caso real: boda salvada en 48h por la garantía',
    ],
    ctaUrl:       'https://fiestago.es/garantia',
    ctaShort:     'mira la garantía',
    hashtagsBase: ['garantiaboda','bodasespaña','protecciónboda','tranquilidadboda'],
  },
  {
    id:        'jueves_real_wedding',
    dayOfWeek: 4,
    label:     'Boda real / Inspiración',
    topicBag: [
      'Una boda de 80 invitados en Valencia: cómo se distribuye el dinero',
      'Boda íntima de 30 personas: por qué cuesta lo mismo proporcionalmente',
      '3 detalles que hicieron viral una boda esta temporada',
      'Bodas pequeñas vs bodas grandes: ventajas reales',
      'Cómo organizar una boda en 3 meses sin morir',
      'El estilo de boda que más se contrata en 2026',
    ],
    ctaUrl:       'https://fiestago.es/buscar',
    ctaShort:     'inspírate en FiestaGo',
    hashtagsBase: ['realweddings','bodasreales','bodasespaña','inspiraciónboda'],
  },
  {
    id:        'viernes_dato',
    dayOfWeek: 5,
    label:     'Dato/estadística',
    topicBag: [
      'El 67% de las parejas se arrepiente de un proveedor: por qué',
      'Cuánto cuesta de media una boda en España en 2026',
      'El día de la semana más caro para casarse',
      'Tiempo medio de planificación de boda en España',
      'Categoría donde más se gasta de más sin querer',
      'Cuántos proveedores se contratan de media para una boda',
    ],
    ctaUrl:       'https://fiestago.es/calculadora',
    ctaShort:     'calcula tu boda real',
    hashtagsBase: ['datosboda','bodasespaña','presupuestoboda','planificarboda'],
  },
  {
    id:        'sabado_sello',
    dayOfWeek: 6,
    label:     'Captación de proveedor — Sello de Calidad',
    topicBag: [
      'Proveedores de bodas: quedan {N} plazas con Sello de Calidad',
      'Por qué el sello convierte 3x más en FiestaGo',
      'Las parejas eligen primero a quien tiene sello',
      'Sello de Calidad: qué pide FiestaGo para dártelo',
      'Cómo ser uno de los 100 proveedores con sello en 2026',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'apúntate al sello',
    hashtagsBase: ['proveedoresboda','marketplaceboda','sellocalidadFiestaGo','proveedoreseventos'],
  },
  {
    id:        'domingo_calculadora',
    dayOfWeek: 0,
    label:     'Calculadora / cuánto cuesta',
    topicBag: [
      'Bodas de 80 invitados: cuánto cuesta realmente en 2026',
      'Boda íntima de 30 personas: presupuesto real',
      'Cuánto cuesta cada parte de la boda en porcentaje',
      'Bodas low-cost que no se notan: trucos reales',
      'Cuánto subió el precio de las bodas desde 2024',
    ],
    ctaUrl:       'https://fiestago.es/calculadora',
    ctaShort:     'tu cálculo en 60 segundos',
    hashtagsBase: ['presupuestoboda','calculadoraboda','bodasespaña','cuantocuestaboda'],
  },
]

// Devuelve el pilar correspondiente al día de hoy en Europe/Madrid.
export function pickPillarForToday(now: Date = new Date()): Pillar {
  const madridDay = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const dow = madridDay.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  return PILLARS.find(p => p.dayOfWeek === dow) || PILLARS[0]
}

// Elige un topic del bag, evitando el último que usamos en BD (anti-repetición).
export function pickTopic(pillar: Pillar, recentTopics: string[] = []): string {
  const fresh = pillar.topicBag.filter(t => !recentTopics.includes(t))
  const pool  = fresh.length > 0 ? fresh : pillar.topicBag
  return pool[Math.floor(Math.random() * pool.length)]
}

// Resultado de la generación: script (lo que dice el avatar), caption (lo
// que va en el post de IG/TikTok) y hashtags.
export type GeneratedContent = {
  script:   string
  caption:  string
  hashtags: string[]
}

const SCRIPT_SYSTEM = `Eres copywriter de vídeos verticales para redes sociales (Instagram Reels, TikTok, YouTube Shorts) de FiestaGo, marketplace de celebraciones en España (bodas, comuniones, cumpleaños, eventos).

Tu trabajo es escribir el GUION HABLADO de un vídeo de 30 segundos que dirá un presentador humano a cámara. El avatar AI lo locuta.

Reglas estrictas del guion:
- Longitud: 65-85 palabras (eso es ~28-32 segundos a velocidad normal en español).
- Hook irresistible en los PRIMEROS 5 SEGUNDOS (≤12 palabras): pregunta provocadora, dato sorprendente, afirmación contraintuitiva. NUNCA empiezas con "Hola" o "Bienvenidos".
- Cuerpo: 3-4 frases cortas que desarrollen el hook. Sin tecnicismos, sin corporativismo. Lenguaje hablado, no escrito.
- CTA al final: 1 frase con el call-to-action proporcionado. Concreto, sin "si quieres", sin "no dudes".
- Español de España. Tono cercano y directo. Sin emojis (los dice un humano, no se ven).
- No menciones "FiestaGo" más de 2 veces.
- No uses listas numeradas habladas ("primero, segundo, tercero") — quedan acartonadas. Encadena con conectores naturales.

Además del guion, devuelves:
- CAPTION para el post: 2-3 frases que enganchen al lector en feed (puede llevar emojis, máx 2). Termina con el CTA en una línea aparte.
- HASHTAGS: 6-10 hashtags relevantes (mezcla de nicho de boda + ciudad si aplica + 1-2 generales tipo #bodas).

FORMATO DE RESPUESTA — devuelve ÚNICAMENTE este JSON, sin texto adicional, sin bloques de código markdown:
{
  "script":   "...",
  "caption":  "...",
  "hashtags": ["...", "..."]
}`

// Genera el guion + caption + hashtags para un pilar + topic dados.
// Incluye plazas con sello en el contexto para que el pilar de sábado
// (captación de proveedor) tenga datos reales.
export async function generateContent(opts: {
  pillar: Pillar
  topic:  string
}): Promise<GeneratedContent> {
  const { pillar, topic } = opts
  const plazas = await countPlazasConSelloRestantes()

  // Sustituir {N} en el topic con plazas reales (para pilar sábado)
  const topicResolved = topic.replace(/\{N\}/g, String(plazas))

  const userMsg =
    `[Pilar de hoy] ${pillar.label}\n` +
    `[Tema concreto] ${topicResolved}\n` +
    `[CTA final del guion] ${pillar.ctaShort} (${pillar.ctaUrl})\n` +
    `[Hashtags base sugeridos] ${pillar.hashtagsBase.join(', ')}\n` +
    `[Contexto FiestaGo] Marketplace de bodas/eventos en España. Alta gratis para proveedores. El cliente paga 8% por Garantía de Éxito. Quedan ${plazas} plazas con Sello de Calidad.\n\n` +
    `Genera el guion (30s), caption y hashtags. JSON puro.`

  const resp = await client().messages.create({
    model:      MODEL,
    max_tokens: 1024,
    thinking:   { type: 'disabled' },
    system: [{
      type: 'text',
      text: SCRIPT_SYSTEM,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMsg }],
  })

  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  // El modelo a veces envuelve en ```json … ``` aunque le pidamos puro.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Respuesta del LLM no es JSON parseable: ${cleaned.slice(0, 200)}`)
  }

  const script   = String(parsed.script   ?? '').trim()
  const caption  = String(parsed.caption  ?? '').trim()
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : []

  if (!script || script.length < 50) {
    throw new Error(`Script demasiado corto: "${script}"`)
  }

  return { script, caption, hashtags }
}
