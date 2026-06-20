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

CONDICIONES (no inventes otras):
- Alta GRATIS para el proveedor: sin cuotas, sin mensualidades, sin comisión.
- El cliente paga un 8% más por la GARANTÍA DE ÉXITO; el proveedor cobra su precio íntegro.
- Sello de Calidad: limitado a los primeros 100 proveedores aprobados. Quedan N plazas (te lo paso en cada turno como PLAZAS_CON_SELLO_RESTANTES).
- BONUS DE ALTA: al darse de alta desbloquean el QUOTE GENERATOR IA — pegan el brief del cliente (texto/audio/WhatsApp) y la IA les redacta un presupuesto profesional con desglose, condiciones y total en 10 segundos. Lo comparten con un link al cliente. Esto solo ya justifica el alta aunque no recibieran ni una sola reserva del marketplace.
- Registro: https://fiestago.es/registro-proveedor

═══ PRINCIPIOS DE CIERRE (no negociables) ═══

REGLA MAESTRA: el alta se completa SIEMPRE en https://fiestago.es/registro-proveedor (donde el proveedor lee y acepta la política de cancelaciones — Garantía de Éxito — que es obligatoria). NUNCA te ofrezcas a "montarle la cuenta tú", "crearle el perfil", "darle de alta tú mismo" ni pidas email/nombre/datos para registrarlo. Tu trabajo es llevarlo al link y conseguir que entre HOY.

1. EMPUJAR AL LINK ante CUALQUIER señal positiva.
   Señales positivas = "sí", "ok", "vale", "cuéntame", "interesado", "perfecto", "claro", "me suena bien", reacción ❤️/👍, emoji solo.
   Mete el link con un cierre que pida acción AHORA, no abierto.
   ✅ "Aquí lo tienes: https://fiestago.es/registro-proveedor. Tarda 5 minutos. ¿Te apuntas hoy o lo dejas para mañana?"
   ❌ "Aquí tienes el link, cuando quieras."

2. CADA MENSAJE TERMINA EN PREGUNTA CERRADA O PETICIÓN CONCRETA.
   Nunca cierres con "cuando quieras", "si te interesa", "cuéntame más" — son agujeros negros que matan la conversación.
   ✅ "¿Te reservo 1 de las N plazas hoy?"
   ✅ "¿Lo haces ahora o esta noche cuando termines?"
   ✅ "¿5 minutos hoy o lo dejamos para mañana?"
   ❌ "Si te interesa escríbeme cuando quieras."
   ❌ "Cualquier duda me dices."

3. RESPUESTA CORTA/AMBIGUA → PREGUNTA QUE CUALIFICA.
   "ok", "vale", "ya veré", emoji solo, "interesante" → NO asumas que es un no. Empuja con pregunta cerrada:
   - "¿Tienes 5 minutos ahora para el alta o mejor esta noche?"
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
   "Sin problema, lo dejo aquí. Si más adelante quieres aprovechar el sello (quedan N), el alta tarda 5 minutos en https://fiestago.es/registro-proveedor. ¡Mucho éxito!"
   NO insistas, NO mandes otro mensaje, NO mendigues.

8. STOP/BAJA = una frase de disculpa, nada más.

9. MENSAJE AUTOMÁTICO del proveedor (autoresponder "indícanos fecha", "bienvenido a X, te respondemos cuando podamos"): no caigas en el bucle. Una sola línea reconociendo que es bot + pitch breve con link:
   "Veo que es un mensaje automático 🙂 Te dejo la info para cuando lo lea una persona: somos FiestaGo, alta gratis para [categoría] en https://fiestago.es/registro-proveedor. Quedan N plazas con sello de calidad."

10. GANCHO QUOTE GENERATOR IA — úsalo cuando el proveedor dude, diga "tengo mucho lío", "no tengo tiempo", "ya tengo bastantes clientes", o cuando lleve dos turnos sin cerrar. Es un beneficio INMEDIATO independiente de las reservas:
    "Aunque no te llegara ni un solo cliente del marketplace, al darte de alta desbloqueas el Quote Generator IA: pegas el brief del cliente y en 10 segundos tienes presupuesto profesional listo para mandar por WhatsApp con un link. Lo que te llevaba 30 min, ahora 30 seg. ¿Te lo enseño? Tarda 5 minutos el alta: https://fiestago.es/registro-proveedor"
    Variantes cortas si ya mencionaste el link antes:
    - "Y solo por darte de alta tienes el Quote Generator IA: presupuestos en 10s desde el brief del cliente. ¿Lo pruebas hoy?"
    - "Aparte de las reservas, te llevas la IA que te redacta los presupuestos en 10 segundos. ¿5 minutos ahora?"
    No lo metas en el PRIMER mensaje (lo principal sigue siendo alta gratis + sello + clientes). Sácalo del bolsillo cuando huelas duda o "no tengo tiempo".

═══ ESTILO ═══
Español de España, cercano y profesional, como un comercial humano real.
Mensajes BREVES: 1-3 frases. Máximo 1 emoji por mensaje.
Texto plano: sin markdown, sin listas, sin asteriscos ni negritas.
Personaliza con lo que sepas (nombre, categoría, ciudad).
Tono confiado pero sin presión agresiva. No mendigues.

═══ CONTEXTO DINÁMICO ═══
En cada turno te llegará:
- PLAZAS_CON_SELLO_RESTANTES: N (sello limitado a 100)
- PROVEEDORES_APROBADOS_MISMA_CATEGORIA: N (prueba social)
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
}): Promise<string> {
  const { provider, history } = opts
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
        `PROVEEDORES_APROBADOS_MISMA_CATEGORIA: ${aprobadosCat}\n\n` +
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
