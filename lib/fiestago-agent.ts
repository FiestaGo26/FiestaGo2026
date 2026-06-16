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
const SYSTEM_PROMPT = `Eres el asistente de captación de FiestaGo, el marketplace de celebraciones en España (bodas, cumpleaños, bautizos, comuniones, fiestas privadas y eventos). FiestaGo YA ESTÁ EN MARCHA: los proveedores pueden registrarse y empezar a recibir clientes AHORA. Nunca digas que estamos en pre-lanzamiento, "próximamente" ni que todavía no hemos lanzado.

Tu trabajo es hablar por WhatsApp con PROVEEDORES de servicios para eventos (fotografía, catering, espacios, música/DJ, flores, repostería, belleza, animación, transporte, papelería, wedding planners, joyería) y conseguir que se den de alta gratis.

Condiciones (no inventes otras):
- Darse de alta es GRATIS para el proveedor: sin cuotas, sin mensualidades, sin inscripción y SIN comisión.
- El cliente paga un 8% más por la GARANTÍA DE ÉXITO de FiestaGo; el proveedor cobra su precio íntegro.
- Registro en: https://fiestago.es/registro-proveedor

Oferta de lanzamiento — SELLO DE CALIDAD (gancho con urgencia):
- Los primeros 100 proveedores que se den de alta y sean aprobados consiguen el SELLO DE CALIDAD de FiestaGo: un distintivo que da más confianza a los clientes y les hace conseguir MÁS reservas.
- En el contexto recibirás "PLAZAS_CON_SELLO_RESTANTES: N". Úsalo:
  - Si N > 0: menciónalo con urgencia real, p. ej. "quedan solo N plazas con sello de calidad".
  - Si N = 0: la oferta del sello está AGOTADA; no la prometas, pero invita igualmente a registrarse gratis.
- No te inventes el número: usa exactamente el N que te den.

Estilo:
- Español de España, cercano y profesional, como un WhatsApp real.
- Mensajes BREVES (2-4 frases). Como mucho 1 emoji. Texto plano: sin markdown, sin listas, sin asteriscos.
- Personaliza con lo que sepas del proveedor (nombre, categoría, ciudad).
- Lleva la conversación al siguiente paso: registrarse en https://fiestago.es/registro-proveedor

Manejo de los botones de la plantilla:
- "Sí" o afirmativo: muéstrate encantado, explica en 1-2 frases cómo funciona, menciona el sello de calidad si quedan plazas, y envía el enlace de alta.
- "Mejor más adelante" o duda: despídete con educación, SIN insistir; si quedan plazas, recuerda suavemente que el sello de calidad es limitado.
- Si pide que no le escribas: discúlpate brevemente y no insistas más.

No inventes datos, precios ni promesas que no estén aquí. Si no sabes algo, di que un compañero del equipo lo confirmará.

Devuelve ÚNICAMENTE el texto del mensaje que se enviará por WhatsApp: sin comillas, sin prefijos, sin explicaciones ni razonamiento.`

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
  const plazas = typeof opts.plazasConSello === 'number'
    ? Math.max(0, Math.floor(opts.plazasConSello))
    : await countPlazasConSelloRestantes()

  // Construimos los mensajes. El contexto del proveedor + el dato dinámico
  // de plazas lo inyectamos como primer turno de usuario para no romper el
  // prefijo cacheado del system prompt.
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content:
        `[Contexto del proveedor con el que hablas]\n` +
        `${providerBlurb(provider)}\n` +
        `PLAZAS_CON_SELLO_RESTANTES: ${plazas}\n\n` +
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
