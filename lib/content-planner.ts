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

// ─── MODO "PROVEEDORES" · captación B2B ────────────────────────────────────
// Los primeros vídeos van enfocados a captar proveedores (objetivo: llenar
// las 100 plazas con Sello de Calidad). Una vez lleno el sello, cambias
// CONTENT_MODE=clients en Netlify y empieza a rotar el set de cliente.
//
// Todos los CTAs van al registro de proveedor. Tono: directo, vendedor de
// oportunidad, FOMO honesto. Hashtags B2B/profesionales del sector.
export const PILLARS_PROVIDERS: Pillar[] = [
  {
    id:        'lunes_diferencial',
    dayOfWeek: 1,
    label:     'Por qué FiestaGo vs otros',
    topicBag: [
      'Por qué FiestaGo es distinto a bodas.net para tu negocio',
      'Marketplaces de bodas: dónde están los clientes que pagan',
      'Lo que ningún otro marketplace de eventos te ofrece',
      'Por qué bodas.net no te trae clientes (y nosotros sí)',
      'La diferencia entre estar en un directorio y estar en un marketplace',
      'Por qué los proveedores se cambian de bodas.net a FiestaGo',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'date de alta gratis',
    hashtagsBase: ['proveedoresboda','marketplaceboda','fotografoboda','djboda','cateringboda','animacionevento'],
  },
  {
    id:        'martes_sello',
    dayOfWeek: 2,
    label:     'Sello de Calidad (FOMO)',
    topicBag: [
      'Solo quedan {N} plazas con Sello de Calidad en FiestaGo',
      'El Sello de Calidad de FiestaGo: por qué te convierte 3x más',
      'Cómo ser uno de los 100 proveedores con sello en 2026',
      'Las parejas eligen primero al proveedor con sello: por qué',
      'Sello de Calidad: qué pide FiestaGo y qué da a cambio',
      'Quedan {N} plazas: por qué los primeros 100 importan tanto',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'reserva tu plaza',
    hashtagsBase: ['sellocalidadFiestaGo','proveedoresboda','marketplaceboda','bodasespaña'],
  },
  {
    id:        'miercoles_economico',
    dayOfWeek: 3,
    label:     '0% comisión — cobras 100%',
    topicBag: [
      'Cero comisión: por qué en FiestaGo cobras tu precio íntegro siempre',
      'Por qué el cliente paga el 8% y tú cobras el 100%',
      'Sin cuotas, sin permanencia, sin comisión: cuánto te cuesta FiestaGo',
      'Cuánto te cuesta estar en FiestaGo: 0€. Lee bien',
      'Otros marketplaces te cobran 15-20%. Nosotros 0%. Por qué',
      'El modelo económico de FiestaGo explicado en 30 segundos',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'date de alta gratis',
    hashtagsBase: ['proveedoresboda','marketplaceboda','sinComision','bodasespaña','fotografoboda'],
  },
  {
    id:        'jueves_proteccion',
    dayOfWeek: 4,
    label:     'Protección al proveedor',
    topicBag: [
      'Si un cliente no te paga: cómo te protege FiestaGo',
      'Pago en escrow: el dinero del cliente está esperándote',
      'Si el cliente cancela 1 semana antes, cómo cobras tu trabajo',
      'Por qué trabajar con FiestaGo elimina el riesgo de impago',
      'La Garantía de Éxito también te protege a ti, no solo al cliente',
      'Cómo FiestaGo media cuando un cliente pide cambios abusivos',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'únete a FiestaGo',
    hashtagsBase: ['proveedoresboda','marketplaceboda','proteccionproveedor','escrow','bodasespaña'],
  },
  {
    id:        'viernes_volumen',
    dayOfWeek: 5,
    label:     'Volumen / oportunidad',
    topicBag: [
      'Una sola boda extra al mes: cuánto suma a fin de año',
      'Por qué llegar el primero a un marketplace nuevo te da ventaja perpetua',
      'El error de esperar a que la plataforma crezca antes de entrar',
      'Cuántas parejas están buscando proveedor en tu zona ahora mismo',
      'Por qué los primeros 100 proveedores van a dominar FiestaGo',
      'Una boda extra al año = +1.500-5.000€ según tu categoría',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'date de alta hoy',
    hashtagsBase: ['proveedoresboda','marketplaceboda','crecenegocio','bodasespaña','primeros100'],
  },
  {
    id:        'sabado_como_alta',
    dayOfWeek: 6,
    label:     'Cómo dar de alta (CTA fuerte)',
    topicBag: [
      'Darte de alta en FiestaGo: 60 segundos paso a paso',
      'Qué necesitas para empezar a recibir clientes en FiestaGo',
      'Lo único que te pedimos en el alta de proveedor',
      'Cómo se ve tu perfil de FiestaGo en 1 minuto',
      'Alta como proveedor: tan fácil como un perfil de Instagram',
      'Empieza hoy, recibe tu primera solicitud esta semana',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'empieza el alta ya',
    hashtagsBase: ['proveedoresboda','altagratis','marketplaceboda','bodasespaña'],
  },
  {
    id:        'domingo_urgencia',
    dayOfWeek: 0,
    label:     'Urgencia mixta · sello + clientes',
    topicBag: [
      'Esta semana entran proveedores nuevos a FiestaGo: no te quedes fuera',
      'Quedan {N} plazas con sello: el reloj corre',
      'Cada día fuera de FiestaGo = una solicitud que se va con otro',
      'Antes de cerrar el mes, hazte un perfil en FiestaGo',
      'La diferencia entre estar dentro y seguir mirando desde fuera',
      'Quedan {N} plazas con sello. ¿Vas a esperar a que se agoten?',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'no lo dejes para mañana',
    hashtagsBase: ['proveedoresboda','sellocalidadFiestaGo','marketplaceboda','urgenciaboda','bodasespaña'],
  },
]

// ─── MODO "CLIENTES" · captación B2C (para más adelante) ──────────────────
// Cuando se llenen las 100 plazas con sello, cambia CONTENT_MODE=clients
// en Netlify y el cron empezará a rotar este set, enfocado a atraer
// parejas que organizan boda / familias con evento.
export const PILLARS_CLIENTS: Pillar[] = [
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

// Modo activo: 'providers' (default) o 'clients'. Se lee de CONTENT_MODE
// en cada cron. Cambiar de modo = cambiar env var en Netlify, redeploy y
// el siguiente cron usará el set correcto.
export type ContentMode = 'providers' | 'clients'
export function activeMode(): ContentMode {
  const m = (process.env.CONTENT_MODE || 'providers').trim().toLowerCase()
  return m === 'clients' ? 'clients' : 'providers'
}

export const PILLARS = PILLARS_PROVIDERS  // compatibilidad con código viejo

// Devuelve el pilar correspondiente al día de hoy en Europe/Madrid según
// el modo activo (providers por defecto, clients cuando se llene el sello).
export function pickPillarForToday(now: Date = new Date()): Pillar {
  const madridDay = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const dow = madridDay.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const set = activeMode() === 'clients' ? PILLARS_CLIENTS : PILLARS_PROVIDERS
  return set.find(p => p.dayOfWeek === dow) || set[0]
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

Tu trabajo es escribir el GUION HABLADO de un vídeo de 20 segundos que dirá un avatar AI a cámara. El objetivo del vídeo es CAPTAR PROVEEDORES — que un fotógrafo, DJ, catering, etc. lo vea y se dé de alta hoy en https://fiestago.es/registro-proveedor.

═══ REGLA DE ORO: HOOK DE PÉRDIDA EN LOS PRIMEROS 3 SEGUNDOS ═══

Los primeros 8-10 palabras DECIDEN si el proveedor se queda mirando o pasa al siguiente vídeo. Tienen que doler. Tiene que sentir que está perdiendo algo AHORA si no actúa. La pérdida vence al beneficio 2:1 en venta.

HOOKS QUE FUNCIONAN (ejemplos para inspirarte, no copies literal):
- "Cada semana fuera de FiestaGo es una boda menos para ti."
- "Si tu competencia ya está dentro y tú no, esto te va a doler."
- "En seis meses los proveedores fuera de FiestaGo lo van a notar."
- "Estás dejando dinero encima de la mesa y ni te enteras."
- "Tus colegas del sector ya se están apuntando. Tú sigues mirando."
- "Lo que pierdes por no estar en FiestaGo no se ve hasta que es tarde."
- "Cada día sin estar aquí, otro proveedor se lleva lo que era tuyo."
- "¿Cuántas bodas vas a dejar pasar este año por no estar dentro?"

HOOKS QUE NO FUNCIONAN (no los uses NUNCA):
- "Hola, soy de FiestaGo y..." → moriste en 1 segundo
- "¿Sabías que FiestaGo es un marketplace..." → corporate puro
- "Hoy te voy a contar..." → educacional, no urgente
- "Si eres fotógrafo de bodas..." → segmentas y pierdes al resto
- "Bienvenido al canal..." → no es un canal, es un Reel

═══ ESTRUCTURA DEL GUION (20 SEGUNDOS) ═══

1. HOOK (0-3s, ≤10 palabras): pérdida tangible. Genera incomodidad.
2. AGRAVA EL DOLOR (3-8s, 1 frase): concretiza lo que está pasando ahora. Ejemplo: "Mientras dudas, hay parejas eligiendo a otros como tú."
3. SOLUCIÓN (8-15s, 1 frase): qué es FiestaGo en términos de qué resuelve, NO en términos de qué es. Ejemplo: "FiestaGo te pone delante de esas parejas. Alta gratis, sin comisión."
4. CTA (15-20s, 1 frase muy corta): acción concreta + el dato del sello. Ejemplo: "Quedan {plazas} plazas con sello. Apúntate hoy."

═══ REGLAS DURAS ═══

- Longitud: 45-55 palabras EXACTAS. Cuenta antes de devolver.
- Español de España. Tuteo. Cero "vosotros" formal, di "tú" siempre — más íntimo y directo.
- Sin emojis (lo dice un humano, no se ven).
- Sin tecnicismos, sin "marketplace de celebraciones" repetido. Como si se lo dijeras a un colega del sector en la barra de un bar.
- NUNCA empieces con "Hola", "Bienvenidos", "Hoy te traigo".
- Usa frases cortas (máx 10 palabras por frase). Punto a punto. Sin párrafos.
- NO listas numeradas habladas. Encadena natural.
- No menciones "FiestaGo" más de 2 veces.
- El CTA es siempre "ir al link / darte de alta hoy / apúntate ya" — nunca "más info" ni "echa un vistazo".

═══ CAPTION + HASHTAGS ═══

CAPTION (texto que va junto al post): 2-3 frases que enganchen al lector mientras hace scroll en feed. Puede llevar emoji (máx 1). Acaba con CTA en línea aparte. Tono similar al guion: pérdida, urgencia, directo.

HASHTAGS: 6-10 hashtags relevantes mezclando nicho del sector + B2B + generales tipo #proveedoresboda.

═══ FORMATO DE RESPUESTA ═══

Devuelve ÚNICAMENTE este JSON, sin texto adicional, sin bloques markdown:
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
