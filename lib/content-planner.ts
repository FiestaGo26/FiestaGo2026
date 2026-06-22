// ───────────────────────────────────────────────────────────────────────
// Planner de contenido diario para redes sociales (Reels/TikTok/Shorts).
// Rota entre 7 pilares (uno por día de la semana) y dentro de cada pilar
// hay una bolsa de temas para que el guion no se repita.
//
// El guion final lo redacta Claude con prompt especializado en copy de
// vídeo vertical 30s: hook fuerte 3s + cuerpo + CTA.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

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
// Los vídeos van enfocados a captar proveedores. El ángulo es VALOR puro:
// que el proveedor escuche 20 segundos y diga "esto me interesa, me apunto".
// NADA de escasez ni "quedan X plazas" — el proveedor se apunta porque ve
// claro el valor inmediato (herramientas IA gratis + 0% comisión + Garantía
// + clientes), no porque le metamos prisa artificial.
//
// Estructura: 7 pilares = 7 días de la semana. Cada día destaca UN ángulo
// específico del valor para no saturar ni repetir.
export const PILLARS_PROVIDERS: Pillar[] = [
  {
    id:        'lunes_pack_ia',
    dayOfWeek: 1,
    label:     'Pack de herramientas IA gratis',
    topicBag: [
      'Tres herramientas IA que te llevas gratis al darte de alta en FiestaGo',
      'El pack que pagado suelto cuesta 265-605€/mes y aquí es gratis',
      'Lo que te ahorra una semana al mes en tareas que odias',
      'Por qué FiestaGo no es un marketplace cualquiera: las herramientas IA',
      'Quote Generator IA, plantillas WhatsApp y posts Google: tuyas gratis',
      'Si no usas FiestaGo, estás pagando software que tienes gratis',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'desbloquéalo gratis hoy',
    hashtagsBase: ['proveedoresboda','iaparafotografos','herramientasboda','fotografoboda','djboda','cateringboda'],
  },
  {
    id:        'martes_quote_generator',
    dayOfWeek: 2,
    label:     'Quote Generator IA',
    topicBag: [
      'Presupuestos profesionales en 10 segundos desde el WhatsApp del cliente',
      'Lo que te llevaba 30-45 minutos, ahora son 10 segundos con IA',
      'Pegar el brief del cliente y tener el presupuesto listo para mandar',
      'Cómo cerrar bodas mientras tu competencia sigue escribiendo presupuestos',
      'Por qué dejar de hacer presupuestos a mano cambia tu negocio',
      'Quote Generator IA: cómo funciona en 30 segundos',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','presupuestoboda','iaeventos','automatizacion','fotografoboda'],
  },
  {
    id:        'miercoles_comision_cero',
    dayOfWeek: 3,
    label:     '0% comisión — cobras 100%',
    topicBag: [
      'Cero comisión: por qué en FiestaGo cobras tu precio íntegro siempre',
      'El cliente paga un 8% extra que financia la Garantía. Tú cobras el 100%',
      'Sin cuotas, sin permanencia, sin comisión: cuánto te cuesta FiestaGo',
      'Otros marketplaces te cobran 15-20%. Nosotros 0%. Por qué',
      'El modelo económico de FiestaGo explicado en 30 segundos',
      'Cuánto cobras tú vs cuánto cobran ellos: la diferencia real',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'cobra el 100% desde hoy',
    hashtagsBase: ['proveedoresboda','marketplaceboda','sinComision','bodasespaña','fotografoboda'],
  },
  {
    id:        'jueves_plantillas_wa',
    dayOfWeek: 4,
    label:     'Plantillas WhatsApp con IA',
    topicBag: [
      'Contesta a tus clientes en 2 clics con las plantillas de FiestaGo',
      '9 respuestas profesionales pre-escritas para cada momento del cliente',
      'Cuánto tiempo pierdes contestando lo mismo cada semana',
      'IA que escribe la plantilla que necesitas en 5 segundos',
      'Por qué responder rápido cierra el doble de bodas que responder bien',
      'Tu WhatsApp profesional, organizado y sin tener que escribir cada respuesta',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','whatsappbusiness','automatizacionwhatsapp','fotografoboda','djboda'],
  },
  {
    id:        'viernes_google_business',
    dayOfWeek: 5,
    label:     'Posts Google Business IA',
    topicBag: [
      'Aparece arriba cuando alguien busca tu servicio en Google con IA',
      'Posts de Google Business escritos automáticamente por IA para ti',
      'Cómo dominar las búsquedas locales sin contratar un community manager',
      'Por qué un post semanal en Google triplica tus consultas',
      'IA que sabe qué keywords te traen clientes en tu ciudad',
      'El community manager que no te cobra 300€ al mes',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','googlebusiness','seolocal','marketingfotografos','iaparaeventos'],
  },
  {
    id:        'sabado_garantia',
    dayOfWeek: 6,
    label:     'Garantía de Éxito + Pago en escrow',
    topicBag: [
      'Si el cliente cancela, cómo FiestaGo te protege a ti',
      'Pago en escrow: el dinero del cliente espera retenido hasta tu evento',
      'Por qué trabajar con FiestaGo elimina el riesgo de impago',
      'La Garantía de Éxito te protege a ti, no solo al cliente',
      'Cómo FiestaGo media cuando un cliente pide cambios abusivos',
      'Tu trabajo blindado: el día del evento sí o sí cobras',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'trabaja sin riesgos',
    hashtagsBase: ['proveedoresboda','proteccionproveedor','escrow','bodasespaña','seguridadboda'],
  },
  {
    id:        'domingo_pack_completo',
    dayOfWeek: 0,
    label:     'Pack completo · 265-605€/mes en valor',
    topicBag: [
      'Lo que te llevas el día que te das de alta en FiestaGo',
      'Aunque no te llegue ni un cliente, ya hoy tienes valor',
      'El stack productivo que multiplica tu margen en bodas',
      'Por qué los proveedores que ya están dentro no se van',
      'Pack completo de FiestaGo: presupuestos, WhatsApp, Google, reservas',
      'Lo que pagarías suelto vs lo que pagas en FiestaGo (gratis)',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'desbloquéalo en 60 segundos',
    hashtagsBase: ['proveedoresboda','marketplaceboda','herramientasboda','bodasespaña','iaeventos'],
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
    id:        'sabado_proveedor_valor',
    dayOfWeek: 6,
    label:     'Mensaje al proveedor que se cruza el Reel',
    topicBag: [
      'Si eres proveedor de bodas, esto te ahorra horas cada semana',
      'Tres herramientas IA gratis para fotógrafos, DJs y catering',
      'Por qué cobrar el 100% de tu trabajo cambia el negocio',
      'Cómo dejar de hacer presupuestos a mano y vender más',
      'El stack productivo gratis para proveedores de eventos',
    ],
    ctaUrl:       'https://fiestago.es/proveedor/valor',
    ctaShort:     'mira lo que te llevas',
    hashtagsBase: ['proveedoresboda','herramientasboda','iaparafotografos','marketplaceboda','proveedoreseventos'],
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

Tu trabajo es escribir el GUION HABLADO de un vídeo de 20 segundos que dirá un avatar AI a cámara. El objetivo es CAPTAR PROVEEDORES — que un fotógrafo, DJ, catering, etc. lo vea y se dé de alta hoy en https://fiestago.es/registro-proveedor por el VALOR REAL que se lleva el día 1, no por miedo a perder algo.

═══ REGLA DE ORO: VALOR INMEDIATO Y CONCRETO QUE ENGANCHA EN 3s ═══

Los primeros 8-10 palabras DECIDEN si el proveedor se queda mirando o pasa al siguiente vídeo. Tienen que ABRIR LOS OJOS con un dato concreto: una cifra (€/mes, minutos ahorrados, horas a la semana), una herramienta nueva, o un beneficio tangible.

NUNCA uses escasez artificial. PROHIBIDO mencionar "plazas que quedan", "los primeros 100", "antes de que se agote", "el reloj corre", "no te quedes fuera". Eso es lenguaje viejo y suena a vendedor desesperado. El proveedor se apunta porque ve VALOR, no porque le metamos prisa falsa.

HOOKS QUE FUNCIONAN (ejemplos para inspirarte, NO copies literal):
- "Tres herramientas IA gratis al darte de alta. Vale más de 265€ al mes."
- "Lo que te llevaba 45 minutos hacer un presupuesto, ahora son 10 segundos."
- "Cobras el 100% de tu precio. El cliente paga el 8% extra. Sin comisión."
- "Contestas a clientes en dos clics con plantillas pre-escritas."
- "Aparece arriba en Google cuando buscan fotógrafo en tu ciudad."
- "Tu trabajo en bodas blindado: si el cliente cancela, tú cobras igual."
- "Pegas el WhatsApp del cliente y la IA te escribe el presupuesto."
- "El community manager que no te cobra 300€ al mes."

HOOKS QUE NO FUNCIONAN (no los uses NUNCA):
- "Hola, soy de FiestaGo y..." → moriste en 1 segundo
- "Quedan X plazas..." → escasez prohibida en este nuevo enfoque
- "Si tu competencia ya está dentro..." → ataque al miedo, prohibido
- "Estás dejando dinero encima de la mesa" → manipulación, prohibido
- "¿Sabías que FiestaGo es un marketplace..." → corporate puro
- "Hoy te voy a contar..." → educacional, no atrae
- "Bienvenido al canal..." → no es un canal, es un Reel

═══ ESTRUCTURA DEL GUION (20 SEGUNDOS) ═══

1. HOOK DE VALOR (0-3s, ≤10 palabras): un dato concreto que sorprende. Cifra, herramienta, o ahorro tangible.
2. AMPLÍA EL VALOR (3-10s, 1-2 frases): cómo funciona ese beneficio en su día a día. Ejemplos:
   - "Pegas el mensaje del cliente. La IA escribe el presupuesto. Te lo lleva un link por WhatsApp."
   - "Contestas en dos clics: nombre, fecha, listo. Como si lo hubieras escrito tú."
3. AHORRO O DIFERENCIA (10-16s, 1 frase): traduce a euros/minutos/clientes. "Pagado suelto serían 30€ al mes. Aquí cero."
4. CTA POSITIVO (16-20s, 1 frase muy corta): acción concreta + REGISTRARSE GRATIS. Ejemplo:
   - "Date de alta gratis en fiestago.es. 60 segundos."
   - "Pruébalo gratis hoy: fiestago.es/proveedor/valor."

═══ REGLAS DURAS ═══

- Longitud: 45-55 palabras EXACTAS. Cuenta antes de devolver.
- Español de España. Tuteo. Cero "vosotros" formal, di "tú" siempre — más íntimo y directo.
- Sin emojis (lo dice un humano, no se ven).
- Sin tecnicismos. Como si se lo dijeras a un colega del sector en la barra de un bar.
- NUNCA empieces con "Hola", "Bienvenidos", "Hoy te traigo".
- Usa frases cortas (máx 10 palabras por frase). Punto a punto. Sin párrafos.
- NO listas numeradas habladas. Encadena natural.
- No menciones "FiestaGo" más de 2 veces.
- El CTA siempre invita a "darte de alta gratis hoy / probarlo gratis" — nunca "más info" ni "echa un vistazo".
- PROHIBIDO mencionar plazas, sello como escasez, ni urgencia artificial.

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
// Sin contexto de plazas/escasez: el enfoque es valor real.
export async function generateContent(opts: {
  pillar: Pillar
  topic:  string
}): Promise<GeneratedContent> {
  const { pillar, topic } = opts

  const userMsg =
    `[Pilar de hoy] ${pillar.label}\n` +
    `[Tema concreto] ${topic}\n` +
    `[CTA final del guion] ${pillar.ctaShort} (${pillar.ctaUrl})\n` +
    `[Hashtags base sugeridos] ${pillar.hashtagsBase.join(', ')}\n` +
    `[Contexto FiestaGo] Marketplace de bodas/eventos en España. Alta gratis para proveedores, sin cuotas ni comisión. El cliente paga 8% extra que financia la Garantía de Éxito; el proveedor cobra su precio íntegro. Al darse de alta, el proveedor desbloquea un pack de herramientas IA gratis (Quote Generator, plantillas WhatsApp, posts Google Business) que pagadas sueltas costarían entre 265€ y 605€ al mes.\n\n` +
    `Genera el guion (20s), caption y hashtags. JSON puro. Recuerda: hook de VALOR, prohibido mencionar plazas/escasez.`

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
