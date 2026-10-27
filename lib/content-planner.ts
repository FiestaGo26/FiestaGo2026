// ───────────────────────────────────────────────────────────────────────
// Planner de contenido diario para redes sociales (Reels/TikTok/Shorts).
// Rota entre 7 pilares (uno por día de la semana) y dentro de cada pilar
// hay una bolsa de temas para que el guion no se repita.
//
// El guion final lo redacta Claude con prompt especializado en copy de
// vídeo vertical 30s: hook fuerte 3s + cuerpo + CTA.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { newAnthropic } from '@/lib/anthropic-client'

// Modelo propio del guion: ANTHROPIC_MODEL lo comparten otras piezas y un
// modelo retirado ahí dejaba sin vídeos (sin vídeos desde el 12-07).
const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5-5'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY')
  _client = newAnthropic()
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
// Los vídeos van enfocados a captar proveedores de TODAS las celebraciones
// (bodas, comuniones, bautizos, cumpleaños, despedidas, fiestas privadas,
// eventos empresariales). Ángulo PRINCIPAL alineado con el cerebro de
// WhatsApp: cada semana hay clientes activos buscando su categoría en su
// zona — los que están dentro reciben las consultas, los que no aparecen,
// no existen. El pack de herramientas IA + 0% comisión + Garantía actúan
// como REFUERZO del valor para que la decisión sea fácil, nunca como
// mensaje principal aislado.
//
// Estructura: 7 pilares = 7 días de la semana. Cada día engancha por un
// ángulo distinto (demanda, IA, comisión, garantía…) pero TODOS arrancan
// desde el marco "hay clientes — parejas, familias, empresas — buscando
// proveedores como tú ahora mismo en FiestaGo".
export const PILLARS_PROVIDERS: Pillar[] = [
  {
    id:        'lunes_demanda_zona',
    dayOfWeek: 1,
    label:     'Demanda activa en tu zona',
    topicBag: [
      'Esta semana hay clientes buscando tu categoría en tu provincia — bodas, comuniones, cumpleaños, eventos de empresa',
      'Cuántas consultas semanales se generan en tu zona para tu servicio — y a quién van',
      'Los clientes no eligen al mejor, eligen al que ven primero. ¿Sales tú?',
      'Si tu competencia ya está dentro, las consultas de esta semana son suyas',
      'Lo que pasa cuando alguien busca catering para un bautizo en tu ciudad y tú no estás listado',
      'Bodas, comuniones, despedidas, fiestas de empresa — todos esos clientes buscan en FiestaGo',
      'Cero coste para aparecer — pero hay que aparecer para que te elijan',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'aparece en 60 segundos',
    hashtagsBase: ['proveedoreseventos','celebraciones','clientesactivos','eventosespaña','fiestasprivadas','eventosempresariales'],
  },
  {
    id:        'martes_quote_generator',
    dayOfWeek: 2,
    label:     'Quote Generator IA + demanda',
    topicBag: [
      'Mientras tú escribes presupuestos a mano, otros cierran las consultas que entran',
      'El cliente pide 4-5 presupuestos. Gana quien contesta antes y mejor',
      'IA que convierte el WhatsApp del cliente en presupuesto listo en 10 segundos',
      'Lo que te llevaba 45 minutos por consulta, ahora 30 segundos — sea boda, cumpleaños o evento de empresa',
      'Cómo cerrar los eventos que entran por FiestaGo mientras tu competencia improvisa',
      'Quote Generator IA: por qué importa cuando hay demanda activa esperando respuesta',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoreseventos','presupuestoeventos','iaeventos','automatizacion','celebraciones'],
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
    hashtagsBase: ['proveedoreseventos','marketplaceeventos','sinComision','eventosespaña','celebraciones'],
  },
  {
    id:        'jueves_plantillas_wa',
    dayOfWeek: 4,
    label:     'Plantillas WhatsApp + velocidad de respuesta',
    topicBag: [
      'El cliente contrata al que responde en menos de 2 horas. Las plantillas te lo garantizan',
      '9 respuestas profesionales pre-escritas para las consultas que entren',
      'Cuántos eventos pierdes a la semana por tardar en contestar — y cómo arreglarlo',
      'IA que escribe la respuesta perfecta a esa consulta nueva en 5 segundos',
      'Responder rápido cierra el doble de eventos que responder elaborado',
      'Las consultas entran. La velocidad las cierra. Las plantillas dan velocidad',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoreseventos','whatsappbusiness','automatizacionwhatsapp','celebraciones','eventosespaña'],
  },
  {
    id:        'viernes_google_business',
    dayOfWeek: 5,
    label:     'Posts Google Business + visibilidad',
    topicBag: [
      'Aparece arriba cuando alguien busca tu servicio en Google — más demanda activa',
      'Los clientes buscan en dos sitios: FiestaGo y Google. Domina los dos a la vez',
      'Posts de Google Business escritos automáticamente por IA, sin community manager',
      'Cómo capturar también la demanda de Google sin pagar 300€/mes',
      'IA que sabe qué keywords te traen clientes en tu ciudad — bodas, comuniones, cumpleaños, empresas',
      'Doble flujo de clientes: el marketplace + tu propio Google bien posicionado',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'pruébalo gratis hoy',
    hashtagsBase: ['proveedoreseventos','googlebusiness','seolocal','marketingeventos','iaparaeventos'],
  },
  {
    id:        'sabado_garantia',
    dayOfWeek: 6,
    label:     'Garantía sobre los clientes que entran',
    topicBag: [
      'Las consultas de FiestaGo vienen con escrow. Si el cliente cancela, tú cobras',
      'Pago en escrow: el dinero del cliente espera retenido hasta el día del evento',
      'Por qué los clientes que entran por FiestaGo dan menos quebraderos de cabeza',
      'La Garantía de Éxito FiestaGo te protege a ti — la financia el cliente, no tú',
      'Cómo FiestaGo media cuando un cliente pide cambios abusivos',
      'Tu trabajo blindado: el día del evento sí o sí cobras (sea boda, cumple o evento de empresa)',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'trabaja sin riesgos',
    hashtagsBase: ['proveedoreseventos','proteccionproveedor','escrow','eventosespaña','seguridadeventos'],
  },
  {
    id:        'domingo_pack_completo',
    dayOfWeek: 0,
    label:     'Pack completo · todo lo que desbloqueas',
    topicBag: [
      'Lo que te llevas el día que te das de alta — además de aparecer ante clientes activos',
      'Aunque tardase en entrar una consulta, el pack IA ya te ahorra 5-10h/semana',
      'El stack productivo que multiplica tu margen en cualquier tipo de celebración',
      'Por qué los proveedores que ya están dentro no se van',
      'Pack completo: aparecer ante demanda + presupuestos + WhatsApp + Google + escrow',
      'Lo que pagarías suelto vs lo que pagas en FiestaGo (gratis)',
    ],
    ctaUrl:       'https://fiestago.es/registro-proveedor',
    ctaShort:     'desbloquéalo en 60 segundos',
    hashtagsBase: ['proveedoreseventos','marketplaceeventos','herramientaseventos','celebraciones','iaeventos'],
  },
]

// ─── MODO "CLIENTES" · captación B2C (activo desde el 26-10-2026) ─────────
// Enfocado a familias, parejas y personas que organizan una celebración, con
// lo aprendido en las simulaciones de clientes: lo que más mueve es saber
// dónde está su dinero, ver que responde una persona, dar el primer paso sin
// pagar y conocer el precio total para su número de invitados. Primero
// cumpleaños (infantiles y de adultos) y comuniones; bodas, con prudencia.
// Sin cifras de mercado ni "casos reales" inventados.
export const PILLARS_CLIENTS: Pillar[] = [
  {
    id:        'lunes_dinero',
    dayOfWeek: 1,
    label:     'Tu dinero, seguro',
    topicBag: [
      'Dónde está tu dinero desde que reservas hasta el día de la fiesta',
      'Por qué el proveedor no cobra hasta que termina tu evento',
      'Qué pasa si el animador cancela una semana antes del cumple',
      'Qué pasa si el fotógrafo no se presenta el día de la comunión',
      'Pagar una señal pequeña en vez de todo por adelantado',
    ],
    ctaUrl:       'https://fiestago.es/garantia',
    ctaShort:     'mira cómo funciona',
    hashtagsBase: ['fiestas','cumpleaños','comuniones','organizarfiesta','fiestago'],
  },
  {
    id:        'martes_cumple_infantil',
    dayOfWeek: 2,
    label:     'Cumpleaños infantil',
    topicBag: [
      'Cómo organizar el cumple de tu peque sin volverte loca',
      'Animador, merienda y sitio: qué contratar primero',
      'Cuánto antes reservar el animador del cumpleaños',
      'Qué preguntar al animador antes de reservar',
      'Cumple en casa o en ludoteca: pros y contras',
    ],
    ctaUrl:       'https://fiestago.es/cumpleanos',
    ctaShort:     'busca tu animador',
    hashtagsBase: ['cumpleañosinfantil','fiestainfantil','animacioninfantil','ideascumpleaños','mamás'],
  },
  {
    id:        'miercoles_mariano_responde',
    dayOfWeek: 3,
    label:     'Mariano responde',
    topicBag: [
      '¿Quién guarda mi dinero hasta la fiesta? Te lo explico en 30 segundos',
      '¿Qué pasa si llueve? Lo que cubre y lo que no la garantía',
      '¿Y si cancelo yo? Así funciona la cancelación',
      '¿Puedo hablar con alguien antes de reservar? Sí, así',
      '¿Cómo sé que el proveedor es de fiar? Así lo comprobamos',
    ],
    ctaUrl:       'https://fiestago.es/quienes-somos',
    ctaShort:     'pregúntanos por WhatsApp',
    hashtagsBase: ['fiestago','preguntasfrecuentes','organizarevento','celebraciones','fiestas'],
  },
  {
    id:        'jueves_comunion',
    dayOfWeek: 4,
    label:     'Comuniones',
    topicBag: [
      'Comunión: qué reservar primero y con cuánta antelación',
      'Restaurante o catering para la comunión: cómo decidir',
      'Cómo calcular el precio de la comunión según invitados',
      'Fotógrafo de comunión: qué debe incluir',
      'Ideas para que los niños no se aburran en la comunión',
    ],
    ctaUrl:       'https://fiestago.es/comuniones',
    ctaShort:     'pide tu presupuesto gratis',
    hashtagsBase: ['comunion','primeracomunion','comuniones2027','fiestacomunion','familia'],
  },
  {
    id:        'viernes_cumple_adulto',
    dayOfWeek: 5,
    label:     'Cumpleaños de adulto',
    topicBag: [
      'Cómo montar un cumple de 40 con amigos sin dejarte el sueldo',
      'DJ y catering para tu cumpleaños: qué preguntar',
      'Fiesta sorpresa: cómo organizarla sin que se entere',
      'Cuánto cuesta una fiesta de cumpleaños para 50 personas: cómo calcularlo',
      'Ideas para celebrar los 30, 40 o 50',
    ],
    ctaUrl:       'https://fiestago.es/buscar',
    ctaShort:     'búscalo en FiestaGo',
    hashtagsBase: ['cumpleaños','fiestadecumpleaños','fiestasorpresa','celebracion','fiesta'],
  },
  {
    id:        'sabado_primer_paso',
    dayOfWeek: 6,
    label:     'Primer paso sin pagar',
    topicBag: [
      'Bloquea tu fecha 48 horas gratis mientras te decides',
      'Pide presupuesto sin compromiso y sin dar tu tarjeta',
      'Cómo comparar proveedores con el precio total a la vista',
      'Por qué no deberías pagar todo por adelantado a un desconocido',
    ],
    ctaUrl:       'https://fiestago.es/buscar',
    ctaShort:     'bloquea tu fecha gratis',
    hashtagsBase: ['organizarfiesta','fiestas','celebraciones','cumpleaños','comuniones'],
  },
  {
    id:        'domingo_quiz',
    dayOfWeek: 0,
    label:     'Quiz: qué necesitas',
    topicBag: [
      'Qué proveedores necesitas para tu celebración en 2 minutos',
      'Checklist para organizar un cumpleaños',
      'Checklist para organizar una comunión',
      'Los 5 pasos para organizar cualquier fiesta sin estrés',
    ],
    ctaUrl:       'https://fiestago.es/quiz',
    ctaShort:     'haz el quiz de 2 minutos',
    hashtagsBase: ['organizarfiesta','checklist','fiestas','celebraciones','ideasfiesta'],
  },
]

// Modo activo: 'clients' (por defecto desde el 26-10-2026) o 'providers'.
// Se lee de CONTENT_MODE en cada cron.
export type ContentMode = 'providers' | 'clients'
export function activeMode(): ContentMode {
  const m = (process.env.CONTENT_MODE || 'clients').trim().toLowerCase()
  return m === 'providers' ? 'providers' : 'clients'
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

const SCRIPT_SYSTEM = `Eres copywriter de vídeos verticales para redes sociales (Instagram Reels, TikTok, YouTube Shorts) de FiestaGo, marketplace de celebraciones en España. FiestaGo cubre TODO tipo de eventos: bodas, comuniones, bautizos, cumpleaños, despedidas de soltero/a, fiestas privadas, eventos y fiestas de empresa. NO es solo bodas — el contenido tiene que reflejarlo.

Tu trabajo es escribir el GUION HABLADO de un vídeo de 20 segundos que dirá un avatar AI a cámara. El objetivo es CAPTAR PROVEEDORES — que un fotógrafo, DJ, catering, espacio, animación, etc. lo vea y se dé de alta hoy en https://fiestago.es/registro-proveedor.

═══ REGLA DE ORO: DEMANDA ACTIVA EN SU ZONA ═══

ÁNGULO PRINCIPAL (mismo cerebro que el agente de WhatsApp de FiestaGo):
Cada semana hay clientes — parejas, familias y empresas — buscando proveedores de su categoría en FiestaGo para celebrar bodas, comuniones, cumpleaños, despedidas, eventos privados o eventos de empresa. SOLO ven a los que están dados de alta — las consultas se las llevan los que aparecen. El proveedor que no está, no existe para ese cliente.

Ese es el marco desde el que se construye CADA guion. El refuerzo del valor (pack IA gratis, 0% comisión, Garantía de Éxito FiestaGo, escrow) sirve para hacer la decisión OBVIA — quitar fricción y miedo al alta — pero NO es el ángulo principal aislado. Primero la demanda real, después por qué entrar es fácil y gratis.

Los primeros 8-10 palabras DECIDEN si el proveedor se queda mirando o pasa al siguiente vídeo. Tienen que ABRIR LOS OJOS con la idea de demanda activa cerca de él, con un dato concreto o una imagen mental clara: parejas buscando AHORA, consultas semanales reales, otros profesionales contestando esas consultas.

NUNCA uses escasez artificial sobre la PLATAFORMA. PROHIBIDO mencionar "plazas que quedan", "los primeros 100", "antes de que se agote", "el reloj corre", "no te quedes fuera del sello". La escasez que SÍ existe y que SÍ puedes usar es la real: las consultas de esta semana se las lleva alguien — si no apareces, no eres tú.

HOOKS QUE FUNCIONAN (ejemplos para inspirarte, NO copies literal):
- "Esta semana hay clientes buscando fotógrafo en tu provincia — bodas, comuniones, eventos de empresa. Si no apareces, contestan otros."
- "Cada semana entran consultas reales en FiestaGo para tu categoría. ¿Quién las contesta?"
- "El cliente pide 4-5 presupuestos. Solo ve a los que están dados de alta."
- "Las consultas de tu zona se las lleva quien aparece, no quien debería aparecer."
- "Mientras lees esto, hay alguien pidiendo presupuesto a un DJ en tu ciudad para un cumpleaños."
- "Bodas, bautizos, despedidas, fiestas de empresa: todos esos clientes buscan en FiestaGo."
- "El cliente no elige al mejor. Elige al primero que ve. Apareces tú o no."

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

// Guion para CLIENTES (modo por defecto desde el 26-10-2026). Lo dice el
// avatar de Mariano, el fundador, a cámara.
const SCRIPT_SYSTEM_CLIENTS = `Eres copywriter de vídeos verticales (Instagram Reels y TikTok) de FiestaGo (fiestago.es), un marketplace de proveedores para cumpleaños infantiles y de adultos, comuniones, bautizos, bodas y fiestas, abierto a toda España. El vídeo lo dice a cámara Mariano, el fundador, en primera persona, con tono cercano y tranquilo, tuteando, en español de España.

Público: madres, padres, parejas y personas que organizan una celebración. Nunca hables a profesionales ni de darse de alta.

Lo que más les preocupa: pagar por adelantado a alguien que no conocen, que el proveedor falle, no saber cuánto les costará todo y no tener a quién preguntar.

Datos verdaderos (usa solo estos; nunca inventes cifras, estadísticas, reseñas, testimonios, clientes ni "casos reales"):
- El pago queda retenido en Stripe y el proveedor no cobra hasta que termina el evento. Se reserva con una señal pequeña.
- Todos los servicios llevan la Garantía de Éxito FiestaGo incluida en el precio: si el proveedor cancela, se busca otro que haga lo mismo a un precio similar en 48 h; si no lo hay, se devuelve todo y un 10 % más; si no se presenta, se devuelve lo pagado más una compensación según el importe. No cubre la lluvia ni los cambios que pida el cliente.
- Precio cerrado a la vista en cada ficha. Se puede bloquear la fecha 48 h gratis o pedir presupuesto sin pagar ni dar la tarjeta.
- Proveedores verificados (DNI o CIF y seguro de responsabilidad civil).
- Se puede preguntar por WhatsApp: contesta una persona de lunes a viernes de 10:00 a 20:00 y los sábados de 10:00 a 14:00.
- Nunca menciones el 8 % ni comisiones.

GUION (unos 20 segundos, 45-60 palabras):
1. Gancho (≤10 palabras): una pregunta o situación que el espectador reconozca de su propio evento.
2. Respuesta clara y concreta al tema del día, útil aunque no use FiestaGo.
3. Cómo lo resuelve FiestaGo, con uno solo de los datos verdaderos.
4. Llamada a la acción final, la que se indica, diciendo "enlace en la bio".
Sin emojis ni hashtags en el guion. Frases cortas, fáciles de decir.

CAPTION: 2-3 frases que respondan a la duda del vídeo, máx. 1 emoji, y la llamada a la acción con "enlace en la bio" en línea aparte.
HASHTAGS: 6-10, del tipo de evento y la ciudad si aplica, en minúsculas y sin almohadilla.

Devuelve ÚNICAMENTE este JSON, sin texto adicional ni bloques markdown:
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

  const forClients = activeMode() === 'clients'
  const userMsg = forClients
    ? `[Pilar de hoy] ${pillar.label}\n[Tema concreto] ${topic}\n[CTA final del guion] ${pillar.ctaShort}\n[Hashtags base sugeridos] ${pillar.hashtagsBase.join(', ')}\n\nGenera el guion (20s), caption y hashtags. JSON puro.`
    :
    `[Pilar de hoy] ${pillar.label}\n` +
    `[Tema concreto] ${topic}\n` +
    `[CTA final del guion] ${pillar.ctaShort} (${pillar.ctaUrl})\n` +
    `[Hashtags base sugeridos] ${pillar.hashtagsBase.join(', ')}\n` +
    `[Contexto FiestaGo] Marketplace de bodas/eventos en España YA EN MARCHA. Cada semana hay parejas y familias buscando proveedores y solo ven a los que están dados de alta — los que aparecen reciben las consultas. Alta gratis, sin cuotas ni comisión. El cliente paga 8% extra que financia la Garantía de Éxito FiestaGo; el proveedor cobra su precio íntegro. Al darse de alta, el proveedor desbloquea un pack de herramientas IA gratis (Quote Generator, plantillas WhatsApp, posts Google Business) que pagadas sueltas costarían entre 265€ y 605€/mes — sirven para QUITAR FRICCIÓN al alta, no como mensaje principal.\n\n` +
    `Genera el guion (20s), caption y hashtags. JSON puro. Recuerda: hook de DEMANDA ACTIVA en su zona/categoría; el ángulo del pilar entra después como refuerzo; CTA al alta gratis hoy. Prohibido escasez sobre plazas/sello.`

  const resp = await client().messages.create({
    model:      MODEL,
    max_tokens: 2000,
    // JSON garantizado (antes fallaba el parseo si el modelo añadía texto)
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object', additionalProperties: false, required: ['script', 'caption', 'hashtags'],
      properties: { script: { type: 'string' }, caption: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } },
    } } },
    system: [{
      type: 'text',
      text: forClients ? SCRIPT_SYSTEM_CLIENTS : SCRIPT_SYSTEM,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMsg }],
  } as any)

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
