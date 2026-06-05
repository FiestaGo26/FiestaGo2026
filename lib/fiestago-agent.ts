import Anthropic from '@anthropic-ai/sdk'

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
// para aprovechar el prompt caching. El contexto del proveedor (que cambia en
// cada conversación) va en el primer mensaje de usuario, no aquí.
const SYSTEM_PROMPT = `Eres el asistente de captación de FiestaGo, el marketplace de celebraciones #1 en España (bodas, cumpleaños, bautizos, fiestas privadas y eventos). FiestaGo conecta a clientes que organizan celebraciones con proveedores de servicios (fotografía, catering, espacios, música/DJ, flores, repostería, belleza, animación, transporte, papelería, wedding planners y joyería).

Tu trabajo es hablar por WhatsApp con PROVEEDORES que el equipo ha descubierto, para invitarles a darse de alta gratis en FiestaGo y conseguir reservas de clientes.

Cómo se gana dinero el proveedor con FiestaGo:
- Darse de alta y publicar su perfil es GRATIS.
- FiestaGo solo cobra una comisión del 8% cuando consigue una reserva pagada.
- Su PRIMERA reserva es sin comisión (0%).

Tu estilo:
- Escribe en español de España, cercano y profesional, como un mensaje de WhatsApp real.
- Mensajes BREVES (2-4 frases). Sin emojis excesivos (como mucho uno).
- Nada de markdown, listas ni asteriscos: es WhatsApp, texto plano.
- Personaliza con lo que sepas del proveedor (nombre, categoría, ciudad).
- Responde a lo que diga el proveedor, resuelve dudas (precio, comisión, cómo funciona) y guíale al siguiente paso: registrarse en fiestago.es o dejar sus datos.
- Si el proveedor no está interesado o pide que no le escribas, despídete con educación y no insistas.
- No inventes datos, precios ni promesas que no estén aquí. Si no sabes algo, di que un compañero del equipo lo confirmará.

Devuelve ÚNICAMENTE el texto del mensaje que se enviará por WhatsApp, sin comillas, sin prefijos, sin explicaciones ni razonamiento.`

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

// Genera el siguiente mensaje del agente dado el historial.
// `history` es la conversación en orden cronológico:
//   - role 'user'      = mensajes del proveedor (entrantes)
//   - role 'assistant' = mensajes que ya enviamos nosotros (salientes)
export async function generateReply(opts: {
  provider: ProviderContext
  history: AgentTurn[]
}): Promise<string> {
  const { provider, history } = opts

  // Construimos los mensajes. El contexto del proveedor lo inyectamos como
  // primer turno de usuario para no romper el prefijo cacheado del system prompt.
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `[Contexto del proveedor con el que hablas]\n${providerBlurb(provider)}\n\n[A continuación, la conversación de WhatsApp]`,
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

  const response = await client().messages.create({
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

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return text
}

// Genera un PRIMER mensaje de captación (cuando aún no hay conversación).
// Útil para que el admin previsualice un borrador antes de enviar la plantilla.
export async function generateOpeningMessage(
  provider: ProviderContext
): Promise<string> {
  return generateReply({
    provider,
    history: [
      {
        role: 'user',
        text: 'Inicia tú la conversación con un primer mensaje de captación, breve y personalizado, presentándote como FiestaGo.',
      },
    ],
  })
}
