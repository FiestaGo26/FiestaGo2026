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
// Los vídeos van enfocados a captar proveedores. Ángulo PRINCIPAL alineado
// con el cerebro de WhatsApp: cada semana hay clientes activos buscando su
// categoría en su zona — los que están dentro reciben las consultas, los
// que no aparecen, no existen. El pack de herramientas IA + 0% comisión +
// Garantía actúan como REFUERZO del valor para que la decisión sea fácil,
// nunca como mensaje principal aislado.
//
// Estructura: 7 pilares = 7 días de la semana. Cada día engancha por un
// ángulo distinto (demanda, IA, comisión, garantía…) pero TODOS arrancan
// desde el marco "hay parejas/familias buscando proveedores como tú ahora
// mismo en FiestaGo".
export const PILLARS_PROVIDERS: Pillar[] = [
  {
    id:        'lunes_demanda_zona',
    dayOfWeek: 1,
    label:     'Demanda activa en tu zona',
    topicBag: [
      'Esta semana hay parejas buscando fotógrafo en tu provincia y eligen a quien aparece',
      'Cuántas consultas se generan a la semana para tu categoría — y a quién van',
      'Las parejas no eligen al mejor, eligen al que ven primero. ¿Sales tú?',
      'Si tu competencia ya está dentro, las consultas de esta semana son suyas',
      'Lo que pasa cuando una pareja busca DJ en tu ciudad y tú no estás listado',
      'Cero coste para aparecer — pero hay que aparecer para que te elijan',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'aparece en 60 segundos',
    hashtagsBase: ['proveedoresboda','clientesactivos','fotografoboda','djboda','cateringboda','bodasespaña'],
  },
  {
    id:        'martes_quote_generator',
    dayOfWeek: 2,
    label:     'Quote Generator IA + demanda',
    topicBag: [
      'Mientras tú escribes presupuestos a mano, otros cierran las consultas que entran',
      'Las parejas piden 4-5 presupuestos. Gana quien contesta antes y mejor',
      'IA que convierte el WhatsApp del cliente en presupuesto listo en 10 segundos',
      'Lo que te llevaba 45 minutos por consulta, ahora 30 segundos — y entran consultas',
      'Cómo cerrar las bodas que entran por FiestaGo mientras tu competencia improvisa',
      'Quote Generator IA: por qué importa cuando hay demanda activa esperando respuesta',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','presupuestoboda','iaeventos','automatizacion','fotografoboda'],
  },
  {
    id:        'miercoles_comision_cero',
    dayOfWeek: 3,
    label:     '0% comisión sobre clientes reales',
    topicBag: [
      'Las consultas que entran por FiestaGo son tuyas al 100%. Sin comisión',
      'El cliente paga un 8% extra que financia la Garantía. Tú cobras tu precio íntegro',
      'Otros marketplaces te cobran 15-20% de cada cliente. Nosotros 0%',
      'Cuánto te cuesta estar dentro de FiestaGo (spoiler: cero euros)',
      'Aparecer ante clientes activos sin que se quede comisión por el camino',
      'Sin cuotas, sin permanencia: solo apareces ante quien busca tu servicio',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'cobra el 100% desde hoy',
    hashtagsBase: ['proveedoresboda','marketplaceboda','sinComision','bodasespaña','fotografoboda'],
  },
  {
    id:        'jueves_plantillas_wa',
    dayOfWeek: 4,
    label:     'Plantillas WhatsApp + velocidad de respuesta',
    topicBag: [
      'La pareja contrata al que responde en menos de 2 horas. Las plantillas te lo garantizan',
      '9 respuestas profesionales pre-escritas para las consultas que entren',
      'Cuántas bodas pierdes a la semana por tardar en contestar — y cómo arreglarlo',
      'IA que escribe la respuesta perfecta a esa consulta nueva en 5 segundos',
      'Responder rápido cierra el doble de bodas que responder elaborado',
      'Las consultas entran. La velocidad las cierra. Las plantillas dan velocidad',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','whatsappbusiness','automatizacionwhatsapp','fotografoboda','djboda'],
  },
  {
    id:        'viernes_google_business',
    dayOfWeek: 5,
    label:     'Posts Google Business + visibilidad',
    topicBag: [
      'Aparece arriba cuando alguien busca tu servicio en Google — más demanda activa',
      'Las parejas buscan dos sitios: FiestaGo y Google. Domina los dos a la vez',
      'Posts de Google Business escritos automáticamente por IA, sin community manager',
      'Cómo capturar también la demanda de Google sin pagar 300€/mes',
      'IA que sabe qué keywords te traen clientes en tu ciudad',
      'Doble flujo de clientes: el marketplace + tu propio Google bien posicionado',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoresboda','googlebusiness','seolocal','marketingfotografos','iaparaeventos'],
  },
  {
    id:        'sabado_garantia',
    dayOfWeek: 6,
    label:     'Garantía sobre los clientes que entran',
    topicBag: [
      'Las consultas de FiestaGo vienen con escrow. Si el cliente cancela, tú cobras',
      'Pago en escrow: el dinero del cliente espera retenido hasta tu evento',
      'Por qué los clientes que entran por FiestaGo dan menos quebraderos de cabeza',
      'La Garantía de Éxito te protege a ti — la financia el cliente, no tú',
      'Cómo FiestaGo media cuando un cliente pide cambios abusivos',
      'Tu trabajo blindado: el día del evento sí o sí cobras',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'trabaja sin riesgos',
    hashtagsBase: ['proveedoresboda','proteccionproveedor','escrow','bodasespaña','seguridadboda'],
  },
  {
    id:        'domingo_pack_completo',
    dayOfWeek: 0,
    label:     'Pack completo · todo lo que desbloqueas',
    topicBag: [
      'Lo que te llevas el día que te das de alta — además de aparecer ante clientes activos',
      'Aunque tardase en entrar una consulta, el pack IA ya te ahorra 5-10h/semana',
      'El stack productivo que multiplica tu margen en bodas',
      'Por qué los proveedores que ya están dentro no se van',
      'Pack completo: aparecer ante demanda + presupuestos + WhatsApp + Google + escrow',
      'Lo que pagarías suelto vs lo que pagas en FiestaGo (gratis)',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
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

Tu trabajo es escribir el GUION HABLADO de un vídeo de 20 segundos que dirá un avatar AI a cámara. El objetivo es CAPTAR PROVEEDORES — que un fotógrafo, DJ, catering, etc. lo vea y se dé de alta hoy en https://fiestago.es/registro-proveedor.

═══ REGLA DE ORO: DEMANDA ACTIVA EN SU ZONA ═══

ÁNGULO PRINCIPAL (mismo cerebro que el agente de WhatsApp de FiestaGo):
Cada semana hay parejas y familias buscando proveedores de su categoría en FiestaGo. SOLO ven a los que están dados de alta — las consultas se las llevan los que aparecen. El proveedor que no está, no existe para ese cliente.

Ese es el marco desde el que se construye CADA guion. El refuerzo del valor (pack IA gratis, 0% comisión, Garantía de Éxito, escrow) sirve para hacer la decisión OBVIA — quitar fricción y miedo al alta — pero NO es el ángulo principal aislado. Primero la demanda real, después por qué entrar es fácil y gratis.

Los primeros 8-10 palabras DECIDEN si el proveedor se queda mirando o pasa al siguiente vídeo. Tienen que ABRIR LOS OJOS con la idea de demanda activa cerca de él, con un dato concreto o una imagen mental clara: parejas buscando AHORA, consultas semanales reales, otros profesionales contestando esas consultas.

NUNCA uses escasez artificial sobre la PLATAFORMA. PROHIBIDO mencionar "plazas que quedan", "los primeros 100", "antes de que se agote", "el reloj corre", "no te quedes fuera del sello". La escasez que SÍ existe y que SÍ puedes usar es la real: las consultas de esta semana se las lleva alguien — si no apareces, no eres tú.

HOOKS QUE FUNCIONAN (ejemplos para inspirarte, NO copies literal):
- "Esta semana hay parejas buscando fotógrafo en tu provincia. Si no apareces, contestan otros."
- "Cada semana entran consultas reales en FiestaGo para tu categoría. ¿Quién las contesta?"
- "Las parejas piden 4-5 presupuestos. Solo ven a los que están dados de alta."
- "Las consultas de tu zona se las lleva quien aparece, no quien debería aparecer."
- "Mientras lees esto, hay alguien pidiendo presupuesto a un DJ en tu ciudad."
- "Las parejas no eligen al mejor. Eligen al primero que ven. Apareces tú o no."

HOOKS QUE NO FUNCIONAN (no los uses NUNCA):
- "Hola, soy de FiestaGo y..." → moriste en 1 segundo
- "Quedan X plazas..." → escasez artificial sobre la plataforma, prohibido
- "El sello se acaba..." → mismo problema, prohibido
- "Estás dejando dinero encima de la mesa" → manipulación vacía, prohibido
- "¿Sabías que FiestaGo es un marketplace..." → corporate puro
- "Hoy te voy a contar..." → educacional, no atrae
- "Bienvenido al canal..." → no es un canal, es un Reel
- Empezar por el pack IA o por "es gratis" — el ángulo principal es DEMANDA, no la herramienta

═══ ESTRUCTURA DEL GUION (20 SEGUNDOS) ═══

1. HOOK DE DEMANDA (0-3s, ≤10 palabras): planta la imagen de clientes buscando AHORA en su zona/categoría. Concreto, no abstracto.
2. AMPLÍA LA DEMANDA + DOLOR (3-9s, 1-2 frases): qué pasa si no aparece. Quién se lleva esas consultas. Ejemplos:
   - "Solo ven a los que están dados de alta. Los demás no existen para esa pareja."
   - "Esa consulta se la lleva uno, no cinco. Gana quien aparece y contesta rápido."
3. ENGANCHE AL PILAR DEL DÍA (9-15s, 1-2 frases): aquí entra el ÁNGULO ESPECÍFICO del pilar (pack IA, 0% comisión, plantillas, escrow…) como el motivo por el que ENTRAR es obvio y sin riesgo. Tradúcelo a su día a día con cifra o ejemplo concreto. Ejemplos:
   - "Y cuando contestas, lo haces en 10 segundos: pegas el WhatsApp del cliente y la IA escribe el presupuesto."
   - "Cobras el 100% — la comisión la paga el cliente como Garantía. Sin trampas."
4. CTA POSITIVO (15-20s, 1 frase muy corta): acción concreta + REGISTRARSE GRATIS HOY. Ejemplos:
   - "Date de alta gratis en fiestago.es. 60 segundos y apareces."
   - "Aparece hoy: fiestago.es/registro-proveedor."

═══ REGLAS DURAS ═══

- Longitud: 45-55 palabras EXACTAS. Cuenta antes de devolver.
- Español de España. Tuteo. Cero "vosotros" formal, di "tú" siempre — más íntimo y directo.
- Sin emojis (lo dice un humano, no se ven).
- Sin tecnicismos. Como si se lo dijeras a un colega del sector en la barra de un bar.
- NUNCA empieces con "Hola", "Bienvenidos", "Hoy te traigo".
- Usa frases cortas (máx 10 palabras por frase). Punto a punto. Sin párrafos.
- NO listas numeradas habladas. Encadena natural.
- No menciones "FiestaGo" más de 2 veces.
- El CTA siempre invita a "darte de alta gratis hoy / aparecer hoy" — nunca "más info" ni "echa un vistazo".
- PROHIBIDO mencionar plazas, sello como escasez, ni urgencia artificial sobre la plataforma. La urgencia real es: las consultas de esta semana son de alguien.
- Coherente con WhatsApp: clientes activos buscando AHORA es el marco; pack IA + 0% comisión + Garantía son el refuerzo que quita fricción.

═══ CAPTION + HASHTAGS ═══

CAPTION (texto que va junto al post): 2-3 frases que enganchen al lector mientras hace scroll en feed. Puede llevar emoji (máx 1). Acaba con CTA en línea aparte. Tono similar al guion: arrancar desde demanda activa real, no desde producto.

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
    `[Contexto FiestaGo] Marketplace de bodas/eventos en España YA EN MARCHA. Cada semana hay parejas y familias buscando proveedores y solo ven a los que están dados de alta — los que aparecen reciben las consultas. Alta gratis, sin cuotas ni comisión. El cliente paga 8% extra que financia la Garantía de Éxito; el proveedor cobra su precio íntegro. Al darse de alta, el proveedor desbloquea un pack de herramientas IA gratis (Quote Generator, plantillas WhatsApp, posts Google Business) que pagadas sueltas costarían entre 265€ y 605€/mes — sirven para QUITAR FRICCIÓN al alta, no como mensaje principal.\n\n` +
    `Genera el guion (20s), caption y hashtags. JSON puro. Recuerda: hook de DEMANDA ACTIVA en su zona/categoría; el ángulo del pilar entra después como refuerzo; CTA al alta gratis hoy. Prohibido escasez sobre plazas/sello.`

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
