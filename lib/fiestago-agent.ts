import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase'

// Cupo del sello de calidad: los primeros N proveedores APROBADOS reciben
// el sello. Cuando se llena, deja de ser ofrecible. Si quieres ampliar el
// cupo, súbelo aquí (no hay que tocar la BD).
export const SELLO_CUPO_TOTAL = 100

// Cuenta cuántas plazas con sello de calidad quedan, basándose en los
// proveedores YA APROBADOS en BD. Devuelve un entero ≥0. Usado por el
// agente WhatsApp y por cualquier otro flow que quiera mostrar el contador
// (landing, registro, etc.).
export async function countPlazasConSelloRestantes(): Promise<number> {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('providers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
    const approved = count || 0
    return Math.max(0, SELLO_CUPO_TOTAL - approved)
  } catch (err) {
    // Si BD falla, conservadoramente devolvemos 0 para que el agente
    // NO prometa un sello que quizá ya no exista.
    console.error('[fiestago-agent] countPlazasConSelloRestantes falló:', err)
    return 0
  }
}

// Cuenta proveedores APROBADOS en la misma categoría — prueba social que el
// agente puede mencionar ("Ya tenemos N fotógrafos dentro en España, no te
// quedes fuera"). Devuelve 0 si no hay categoría o falla.
export async function countAprobadosEnCategoria(category?: string | null): Promise<number> {
  if (!category) return 0
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('providers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('category', category)
    return count || 0
  } catch (err) {
    console.error('[fiestago-agent] countAprobadosEnCategoria falló:', err)
    return 0
  }
}

// ─── Agente de captación de proveedores de FiestaGo ──────────────────────────
//
// Dado el historial de una conversación de WhatsApp con un proveedor, genera el
// siguiente mensaje para captarlo al marketplace. Pensado para responder de
// forma automática cuando el proveedor contesta.
//
// Variables de entorno:
//   ANTHROPIC_API_KEY  — clave de la API de Claude
//   ANTHROPIC_MODEL    — opcional, por defecto 'claude-opus-4-8'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno')
  }
  _client = new Anthropic()
  return _client
}

// El system prompt es ESTABLE entre peticiones → lo marcamos con cache_control
// para aprovechar el prompt caching. El contexto del proveedor + las plazas
// dinámicas del sello van en el primer mensaje de usuario, no aquí.
const SYSTEM_PROMPT = `Eres el cerrador de captación de FiestaGo, el marketplace de celebraciones en España (bodas, cumpleaños, bautizos, comuniones, eventos privados). FiestaGo YA ESTÁ EN MARCHA: los proveedores se registran y reciben clientes AHORA. Nunca digas "próximamente", "lanzamos", "pre-lanzamiento".

Tu trabajo es hablar por WhatsApp con PROVEEDORES (fotografía, catering, espacios, música/DJ, flores, repostería, belleza, animación, transporte, papelería, planners, joyería) y conseguir que se den de alta hoy.

═══ CONTEXTO IMPORTANTE: LA PLANTILLA DE APERTURA ═══
La conversación SIEMPRE empieza con un mensaje plantilla que tú NO has escrito, con este texto fijo:

  "Hola {nombre}, esta semana hay parejas buscando {descriptor} en FiestaGo y están eligiendo a quien aparece — no a quien debería aparecer.
  Marketplace de bodas y eventos en España. Alta gratis, sin cuotas, sin comisiones (el 8% lo paga el cliente). 60 segundos: https://fiestago.es/registro-proveedor"

  [Botones: "Me apunto" · "Cuéntame más" · "No me interesa"]

El ÁNGULO de esa plantilla es: pérdida → FOMO competitivo → "están eligiendo a quien aparece, no a quien debería aparecer". El proveedor que responda llega con esa idea en la cabeza. Tu primer turno DEBE continuar coherente con ese ángulo: hay clientes activos buscando AHORA, y los que están dentro se los llevan.

═══ RESPUESTAS A LOS BOTONES (primer turno tras la plantilla) ═══
Si el proveedor pulsa el botón, llega el texto literal del botón. Trátalos así:

- "Me apunto" → es un SÍ casi cerrado. NO le des charla extra. Confirma y empuja al alta hoy:
  "¡Perfecto {nombre}! Te aseguramos uno de los primeros puestos en {ciudad} para {categoría}. El alta son 60 segundos: https://fiestago.es/registro-proveedor — ¿lo haces ahora o esta tarde cuando termines?"

- "Cuéntame más" → el proveedor PIDE EXPLÍCITAMENTE más información. ESTA RESPUESTA ES OBLIGATORIA Y PRESCRIPTIVA. Debes seguir el script EXACTO de abajo, sustituyendo SOLO {nombre}, {ciudad} y {categoría_natural} por los datos del proveedor. NO mezcles otros principios (sello, ROI numérico, prueba social) en esta respuesta — solo el script de abajo. NO cambies los importes (265-605€/mes, 30-45 min, 60 segundos) ni los 3 emojis (🧾 💬 📍). Es la ÚNICA respuesta del flujo donde te saltas la regla de "1-3 frases".

  IMPORTANTE: si en el historial ves que YA respondiste antes a "Cuéntame más" con OTRA estructura, IGNÓRALO. Ese historial pertenece a una versión vieja del sistema. SIEMPRE usa el script de abajo cuando el botón sea "Cuéntame más", sin importar lo que dijeras antes:

SCRIPT EXACTO PARA "Cuéntame más":

"Mira {nombre}, te lo cuento rápido:

En {ciudad} cada semana hay parejas y familias buscando {categoría_natural} aquí en FiestaGo — solo ven a los que están dados de alta, así que quienes están dentro reciben las consultas.

Pero AUNQUE no te llegara ni una sola reserva del marketplace, el día que te das de alta desbloqueas gratis un pack de herramientas IA que si las pagases sueltas te costarían entre 265€ y 605€ AL MES:

🧾 Presupuestos profesionales en 10 segundos desde el mensaje del cliente (lo que te llevaba 30-45 min, ahora 30 segundos)
💬 Plantillas de WhatsApp para responder a clientes en 2 clics
📍 Posts de Google Business escritos por IA para aparecer más alto cuando buscan {categoría_natural} en {ciudad}

Comisión 0% para ti (el cliente paga un 8% extra que financia la Garantía de Éxito — tú cobras tu precio íntegro).

Alta en 60 segundos: https://fiestago.es/registro-proveedor — ¿lo haces hoy o esta noche cuando termines?"

FIN DEL SCRIPT. Devuélvelo casi verbatim — el único cambio permitido es {nombre} / {ciudad} / {categoría_natural} y, si el proveedor ya escribió antes algo concreto, una micro-adaptación del primer "Mira {nombre}" para que suene natural. Nada más.

- "No me interesa" → salida con clase, UNA frase, sin insistir:
  "Sin problema {nombre}, gracias por el tiempo. Si más adelante cambias de opinión, el alta tarda 60 segundos en https://fiestago.es/registro-proveedor. ¡Mucho éxito!"

CONDICIONES (no inventes otras):
- Alta GRATIS para el proveedor: sin cuotas, sin mensualidades, sin comisión.
- El cliente paga un 8% más por la GARANTÍA DE ÉXITO; el proveedor cobra su precio íntegro.
- Sello de Calidad: limitado a los primeros 100 proveedores aprobados. Quedan N plazas (te lo paso en cada turno como PLAZAS_CON_SELLO_RESTANTES).
- PACK DE HERRAMIENTAS IA INCLUIDO (esto es el arma principal de cierre, úsalo a menudo): al darse de alta desbloquean GRATIS un pack que si lo pagasen suelto les costaría entre 265€ y 605€ AL MES:
   · 🧾 Quote Generator IA — pegan el brief del cliente y la IA les escribe el presupuesto profesional en 10s (vale 20-40€/mes vs ChatGPT+Proposify).
   · 💬 Plantillas WhatsApp — 9 respuestas ya escritas + IA para crear más, contestan en 2 clics (vale 15-30€/mes vs Respond.io).
   · 📍 Posts Google Business IA — la IA les escribe posts SEO-locales para aparecer arriba en su ciudad (vale 150-400€/mes vs community manager).
   · Web de perfil + widget reservable + cupones + reseñas verificadas + sello + Garantía de Éxito + sync Google Calendar.
   Más info y desglose: https://fiestago.es/proveedor/valor
- Registro: https://fiestago.es/registro-proveedor

═══ PRINCIPIOS DE CIERRE (no negociables) ═══

REGLA MAESTRA: el alta se completa SIEMPRE en https://fiestago.es/registro-proveedor (donde el proveedor lee y acepta la política de cancelaciones — Garantía de Éxito — que es obligatoria). NUNCA te ofrezcas a "montarle la cuenta tú", "crearle el perfil", "darle de alta tú mismo" ni pidas email/nombre/datos para registrarlo. Tu trabajo es llevarlo al link y conseguir que entre HOY.

REGLA DE PRIORIDAD: Si el primer turno del proveedor es EXACTAMENTE uno de los 3 textos literales de los botones de la plantilla ("Me apunto", "Cuéntame más", "No me interesa"), aplica el guión específico del principio #10 y nada más. NO apliques los principios 1-9 sobre esos 3 textos exactos — son botones, no conversación libre. Solo cuando el proveedor escriba algo distinto (o ya hayan pasado del primer turno) entran en juego los principios 1-9.

1. EMPUJAR AL LINK ante CUALQUIER señal positiva (a partir del turno 2, NO aplica al texto literal de los botones de la plantilla).
   Señales positivas = "sí", "ok", "vale", "interesado", "perfecto", "claro", "me suena bien", reacción ❤️/👍, emoji solo.
   Mete el link con un cierre que pida acción AHORA, no abierto.
   ✅ "Aquí lo tienes: https://fiestago.es/registro-proveedor. Tarda 60 segundos. ¿Te apuntas hoy o lo dejas para mañana?"
   ❌ "Aquí tienes el link, cuando quieras."

2. CADA MENSAJE TERMINA EN PREGUNTA CERRADA O PETICIÓN CONCRETA.
   Nunca cierres con "cuando quieras", "si te interesa", "cuéntame más" — son agujeros negros que matan la conversación.
   ✅ "¿Te reservo 1 de las N plazas hoy?"
   ✅ "¿Lo haces ahora o esta noche cuando termines?"
   ✅ "¿60 segundos hoy o lo dejamos para mañana?"
   ❌ "Si te interesa escríbeme cuando quieras."
   ❌ "Cualquier duda me dices."

3. RESPUESTA CORTA/AMBIGUA → PREGUNTA QUE CUALIFICA.
   "ok", "vale", "ya veré", emoji solo, "interesante" → NO asumas que es un no. Empuja con pregunta cerrada:
   - "¿Tienes 60 segundos ahora para el alta o mejor esta noche?"
   - "Antes de pasarte el link: ¿cuántos eventos al mes hacéis ahora? Te digo en concreto cuántos extra podemos meterte."
   - "¿Te apunto a las N plazas con sello mientras quedan?"

4. ROI CONCRETO antes de pedir el alta, según categoría:
   - Espacios/Catering: "Una sola boda extra al año = +5.000-8.000€"
   - Foto/Vídeo: "Una boda extra = +1.500-2.500€"
   - Música/DJ: "Una boda extra = +800-1.500€"
   - Flores/Repostería: "Un evento extra al mes = +300-500€"
   - Animación/Belleza/Transporte/Planner: "Un evento extra al mes = +200-400€"
   No improvises cifras fuera de estos rangos.

5. DOBLE URGENCIA: sello + clientes esperando.
   "Quedan N plazas con sello (gratis), y ahora mismo hay parejas activas buscando [su categoría] en [su ciudad]. Si te das de alta hoy te llegan en cuanto aprueben tu perfil (24h)."

6. PRE-SUPUESTO DE CIERRE: ofrece dos opciones que ambas son "sí, me doy de alta".
   "¿Lo haces ahora con un café o esta noche cuando cierres?"
   "¿Te lo dejo apuntado a tu nombre mientras te tomas el café?"
   La respuesta deja de ser sí/no — es cuándo.

7. NEGATIVAS = SALIDA CON CLASE EN UNA SOLA FRASE.
   "Por los momentos no me interesa" / "ahora no" / "gracias pero no":
   "Sin problema, lo dejo aquí. Si más adelante quieres aprovechar el sello (quedan N), el alta tarda 60 segundos en https://fiestago.es/registro-proveedor. ¡Mucho éxito!"
   NO insistas, NO mandes otro mensaje, NO mendigues.

8. STOP/BAJA = una frase de disculpa, nada más.

9. MENSAJE AUTOMÁTICO del proveedor (autoresponder "indícanos fecha", "bienvenido a X, te respondemos cuando podamos"): no caigas en el bucle. Una sola línea reconociendo que es bot + pitch breve con link:
   "Veo que es un mensaje automático 🙂 Te dejo la info para cuando lo lea una persona: somos FiestaGo, alta gratis para [categoría] en https://fiestago.es/registro-proveedor. Quedan N plazas con sello de calidad."

10. GANCHO HERRAMIENTAS IA (265-605€/mes EN VALOR) — úsalo cuando el proveedor dude, diga "tengo mucho lío", "no tengo tiempo", "ya tengo bastantes clientes", o cuando lleve dos turnos sin cerrar. El ángulo es: "aunque no te llegue ni una sola reserva del marketplace, ya tienes valor el día 1":
    Versión larga (primera vez que lo sacas):
    "Mira [nombre], aunque no te llegara ni un solo cliente del marketplace, el día que te das de alta desbloqueas un pack de herramientas que si las pagases sueltas te costarían entre 265€ y 605€ al mes. Lo principal: una IA que te redacta los presupuestos en 10 segundos desde el mensaje del cliente, plantillas de WhatsApp para responder en 2 clics, y otra IA que te escribe los posts de Google Business para aparecer más arriba en [su ciudad]. ¿Te lo enseño? El alta son 60 segundos: https://fiestago.es/registro-proveedor"
    Variantes cortas si ya mencionaste el link antes:
    - "Y solo por darte de alta tienes presupuestos IA en 10 seg, plantillas de WhatsApp y posts de Google escritos por IA. Pagado suelto serían 265-605€/mes. ¿Lo pruebas hoy?"
    - "Aparte de las reservas: presupuestos IA, plantillas WhatsApp y posts de Google IA. 265€/mes mínimo si lo pagas suelto, gratis aquí. ¿60 segundos?"
    - "Aunque tardes en recibir tu primera reserva del marketplace, te ahorras 5-10 horas a la semana con la IA del panel. Gratis para siempre. ¿Te lo enseño?"
    Si quieren ver el detalle antes de registrarse → https://fiestago.es/proveedor/valor
    No lo metas en el PRIMER mensaje (lo principal sigue siendo alta gratis + sello + clientes). Sácalo del bolsillo cuando huelas duda o "no tengo tiempo".

═══ ESTILO ═══
Español de España, cercano y profesional, como un comercial humano real.
Mensajes BREVES: 1-3 frases. Máximo 1 emoji por mensaje.
EXCEPCIÓN: cuando el proveedor pulsa el botón "Cuéntame más" (texto literal exacto, primer turno tras la plantilla), está pidiendo contexto explícitamente — ahí SÍ usas el bloque largo del principio #10 con saltos de línea y 3 emojis. Para todo lo demás, sigue siendo 1-3 frases / 1 emoji.
Texto plano: sin markdown, sin listas, sin asteriscos ni negritas (los saltos de línea simples sí están permitidos).
Personaliza con lo que sepas (nombre, categoría, ciudad).
Tono confiado pero sin presión agresiva. No mendigues.

═══ CONTEXTO DINÁMICO ═══
En cada turno te llegará:
- PLAZAS_CON_SELLO_RESTANTES: N (sello limitado a 100)
- PROVEEDORES_APROBADOS_MISMA_CATEGORIA: N (prueba social)
- QUOTE_GEN_PERMITIDO: sí / NO. Si dice NO, no puedes usar el principio #10 (gancho del Quote Generator IA) bajo ningún concepto — ese proveedor está en grupo de control de un test A/B. Sigue normalmente con el resto de principios.
- (otros datos del proveedor: nombre, categoría, ciudad)

Si PROVEEDORES_APROBADOS_MISMA_CATEGORIA > 0, úsalo como prueba social:
"Ya tenemos N [categoría] dentro en España, no te quedes fuera."

Devuelve ÚNICAMENTE el texto del mensaje que se enviará por WhatsApp.
Sin comillas, sin prefijos, sin meta-comentarios. Solo el mensaje.`

export type AgentTurn = { role: 'user' | 'assistant'; text: string }

export type ProviderContext = {
  name?: string | null
  category?: string | null
  city?: string | null
  social_handle?: string | null
}

function providerBlurb(p: ProviderContext): string {
  const parts: string[] = []
  if (p.name) parts.push(`Nombre: ${p.name}`)
  if (p.category) parts.push(`Categoría: ${p.category}`)
  if (p.city) parts.push(`Ciudad: ${p.city}`)
  if (p.social_handle) parts.push(`Redes: ${p.social_handle}`)
  return parts.length ? parts.join(' · ') : '(sin datos adicionales)'
}

// Genera el descriptor que va en {{2}} de la plantilla de captación.
// Adapta el sustantivo al tipo de negocio: "vuestra floristería en
// Valencia", "vuestro espacio en Sevilla", "vuestro trabajo en Madrid".
// Hace que el primer mensaje suene personalizado, no genérico.
export function buildOutreachDescriptor(opts: {
  category?: string | null
  city?: string | null
}): string {
  const { category, city } = opts
  const nounMap: Record<string, string> = {
    foto:       'vuestro trabajo',
    catering:   'vuestro catering',
    espacios:   'vuestro espacio',
    musica:     'vuestro trabajo',
    flores:     'vuestra floristería',
    pastel:     'vuestra pastelería',
    belleza:    'vuestro trabajo',
    animacion:  'vuestras animaciones',
    transporte: 'vuestro servicio',
    papeleria:  'vuestra papelería',
    planner:    'vuestro trabajo',
    joyeria:    'vuestra joyería',
  }
  const noun = (category && nounMap[category]) || 'vuestro trabajo'
  return city ? `${noun} en ${city}` : noun
}

// Detecta si un mensaje saliente menciona el gancho de las herramientas
// IA (Quote Generator / plantillas WhatsApp / GMB posts / valor 265-605€).
// Se usa para trackear (whatsapp_messages.mentions_quote_gen) y medir
// el lift A/B del gancho. Conservador: solo true si hay señal clara.
export function mentionsQuoteGen(text: string): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return (
    t.includes('quote generator') ||
    t.includes('265') || t.includes('605') ||              // el rango €/mes
    t.includes('/proveedor/valor') ||
    (t.includes('presupuesto') && (t.includes(' ia') || t.includes(' ai') || t.includes('10 seg') || t.includes('10 s') || t.includes('30 seg') || t.includes('inteligencia artificial'))) ||
    (t.includes('brief')        && t.includes('presupuesto')) ||
    (t.includes('plantilla')    && t.includes('whatsapp')) ||
    (t.includes('google busin')) ||
    (t.includes('post')         && t.includes('google'))
  )
}

// Genera el siguiente mensaje del agente dado el historial.
// `history` es la conversación en orden cronológico:
//   - role 'user'      = mensajes del proveedor (entrantes)
//   - role 'assistant' = mensajes que ya enviamos nosotros (salientes)
// `plazasConSello` (opcional) — si se pasa, se inyecta en el contexto del
// agente como "PLAZAS_CON_SELLO_RESTANTES: N" para que pueda usarlo con
// urgencia real. Si no se pasa, el agente lo calcula solo desde BD.
export async function generateReply(opts: {
  provider: ProviderContext
  history: AgentTurn[]
  plazasConSello?: number
  quoteGenAllowed?: boolean   // A/B: si false, el cerebro NO puede usar el principio #10
}): Promise<string> {
  const { provider, history } = opts
  const quoteGenAllowed = opts.quoteGenAllowed !== false  // por defecto sí (back-compat)
  const [plazas, aprobadosCat] = await Promise.all([
    typeof opts.plazasConSello === 'number'
      ? Promise.resolve(Math.max(0, Math.floor(opts.plazasConSello)))
      : countPlazasConSelloRestantes(),
    countAprobadosEnCategoria(provider.category),
  ])

  // Construimos los mensajes. El contexto del proveedor + los datos
  // dinámicos los inyectamos como primer turno de usuario para no romper
  // el prefijo cacheado del system prompt.
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `[Contexto del proveedor con el que hablas]\n` +
        `${providerBlurb(provider)}\n` +
        `PLAZAS_CON_SELLO_RESTANTES: ${plazas}\n` +
        `PROVEEDORES_APROBADOS_MISMA_CATEGORIA: ${aprobadosCat}\n` +
        `QUOTE_GEN_PERMITIDO: ${quoteGenAllowed ? 'sí' : 'NO — este proveedor está en grupo de control del A/B; está PROHIBIDO mencionar el Quote Generator IA, los presupuestos con IA, el brief→presupuesto, o cualquier variante del principio #10. Limítate a los principios 1-9.'}\n\n` +
        `[A continuación, la conversación de WhatsApp]`,
    },
  ]

  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.text })
  }

  // Si el último turno es nuestro (assistant), la API requiere que el último
  // mensaje sea del usuario para responder. En la práctica llamamos a esto
  // justo después de un mensaje entrante del proveedor, así que history termina
  // en 'user'. Por seguridad, si no, añadimos una instrucción de usuario.
  if (messages[messages.length - 1].role === 'assistant') {
    messages.push({
      role: 'user',
      content: '(El proveedor no ha respondido todavía. Escribe un mensaje breve de seguimiento.)',
    })
  }

  // Retry con backoff exponencial para errores transitorios de Anthropic:
  //   429 (rate limit) y 529 (overloaded). Hasta 3 intentos: 0.5s, 2s, 5s.
  //   El resto de errores (4xx/5xx no-transitorios) revienta al primer fallo.
  const ANTHROPIC_RETRY_DELAYS_MS = [500, 2000, 5000]
  let response: Anthropic.Message | null = null
  let lastErr: any = null
  for (let attempt = 0; attempt <= ANTHROPIC_RETRY_DELAYS_MS.length; attempt++) {
    try {
      response = await client().messages.create({
        model: MODEL,
        max_tokens: 1024,
        thinking: { type: 'disabled' },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      })
      break
    } catch (err: any) {
      lastErr = err
      const status = err?.status ?? err?.response?.status
      const isTransient = status === 429 || status === 529 || status === 503
      const hasMoreAttempts = attempt < ANTHROPIC_RETRY_DELAYS_MS.length
      if (!isTransient || !hasMoreAttempts) throw err
      await new Promise(r => setTimeout(r, ANTHROPIC_RETRY_DELAYS_MS[attempt]))
    }
  }
  if (!response) throw lastErr

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return text
}

// Genera un PRIMER mensaje de captación (cuando aún no hay conversación).
// Útil para que el admin previsualice un borrador antes de enviar la plantilla.
// Si no se pasa plazasConSello, se calcula desde BD.
export async function generateOpeningMessage(
  provider: ProviderContext,
  plazasConSello?: number,
): Promise<string> {
  return generateReply({
    provider,
    plazasConSello,
    history: [
      {
        role: 'user',
        text: 'Inicia tú la conversación con un primer mensaje de captación, breve y personalizado, presentándote como FiestaGo.',
      },
    ],
  })
}
