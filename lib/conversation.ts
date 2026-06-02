// ───────────────────────────────────────────────────────────────────────
// Agente conversacional de captación de proveedores de FiestaGo.
//
// Dado el historial de conversación con un proveedor, genera la siguiente
// respuesta y decide si se puede enviar SOLA (caso claro) o si hay que
// ESCALAR a un humano (caso sensible). Esta es la "red de seguridad".
//
// La meta de cada conversación: que el proveedor se dé de alta en
// https://fiestago.es/registro-proveedor
// ───────────────────────────────────────────────────────────────────────

const MODEL = process.env.CONVERSATION_MODEL || 'claude-sonnet-4-6'

export type ConvMessage = { direction: 'in' | 'out'; body: string }

export type ConvProvider = {
  name?: string | null
  city?: string | null
  category?: string | null
  description?: string | null
}

export type ConvDecision = {
  reply: string
  intent: string        // greeting | question | interested | objection | register_intent | not_interested | complaint | human_request | other
  needsHuman: boolean   // true → NO enviar, escalar a un humano
  autosend: boolean     // true → la IA puede enviar sola
  reason: string        // por qué autorespondió o escaló
  confidence: number    // 0-100
}

// Base de conocimiento de FiestaGo — fuente de verdad para las respuestas.
const FIESTAGO_KB = `
DATOS DE FIESTAGO (úsalos, no inventes nada fuera de aquí):
- Qué es: marketplace de celebraciones en España (bodas, cumpleaños, comuniones, eventos privados y de empresa). Conecta a quien organiza un evento con proveedores de calidad.
- Lanzamiento oficial: 10 de junio de 2026. Ahora se está construyendo el catálogo inicial: los primeros profesionales tienen mejor posición en los resultados.
- Web de alta para proveedores: https://fiestago.es/registro-proveedor (alta en ~2 minutos, gratis).
- Modelo económico para el proveedor:
  · Registro GRATIS. Sin cuota mensual ni anual. Sin permanencia.
  · El proveedor cobra el 100% del precio que pone en su ficha.
  · La comisión del 8% la paga el CLIENTE encima del precio, como "Garantía de Éxito" (si algo sale mal con la reserva, FiestaGo responde económicamente al cliente).
  · La PRIMERA venta del proveedor es 0% de comisión.
- Comparación: a diferencia de Bodas.net o Zankyou, no hay cuota anual cara ni permanencia.
- Ventajas de entrar antes del lanzamiento:
  · Mejor posición en los resultados (catálogo en construcción).
  · Sello FiestaGo de Calidad GRATIS, visible junto al perfil mientras se mantenga 4,5/5 en reseñas.
  · Promoción gratuita en redes (@fiestagospain).
  · Programa "trae a un compañero": si invita a otro profesional y se registra, los dos suben al top de su categoría sin coste.
- Contacto humano: contacto@fiestago.es
- Quién escribe: el equipo de FiestaGo (Mariano es el fundador).
`

function systemPrompt(p: ConvProvider): string {
  return `Eres un agente de captación de FiestaGo que conversa por WhatsApp con un profesional de eventos para que se dé de alta en la plataforma.

PROVEEDOR CON EL QUE HABLAS:
- Nombre: ${p.name || 'desconocido'}
- Ciudad: ${p.city || 'desconocida'}
- Categoría: ${p.category || 'desconocida'}
${p.description ? `- Sobre su negocio: ${p.description}` : ''}

${FIESTAGO_KB}

ESTILO (muy importante):
- Español de España, cercano y profesional. Hablas de "tú". Nada de latinoamericanismos.
- Mensajes CORTOS de WhatsApp (1-4 frases, máximo ~600 caracteres). Sin folletos.
- 0-1 emoji por mensaje como mucho. Natural, no comercial agresivo.
- Responde SIEMPRE a lo que el proveedor acaba de decir. Resuelve su duda concreta antes de empujar.
- El objetivo es que se registre en https://fiestago.es/registro-proveedor. Incluye el enlace solo cuando aporte (cuando muestra interés o pide cómo hacerlo), no en cada mensaje.
- No prometas nada que no esté en los DATOS DE FIESTAGO. No inventes precios, fechas ni condiciones.

RED DE SEGURIDAD — marca needsHuman=true (y NO se enviará tu respuesta, la revisará una persona) si:
- Hay una queja seria, enfado, amenaza legal o de reputación.
- Piden negociar condiciones especiales, exclusividad o algo fuera de los DATOS DE FIESTAGO.
- Piden hablar con una persona / con el fundador.
- Hacen una pregunta cuya respuesta NO está en los DATOS DE FIESTAGO y no puedes responder con certeza.
- Dudas de si tu respuesta podría dañar la marca.
En cambio, needsHuman=false para casos claros: saludos, dudas normales (precio, comisión, cómo darse de alta, qué es FiestaGo, sello, garantía), objeciones típicas que sabes rebatir, o decir que no le interesa (despídete con educación).

Si el proveedor dice claramente que YA se ha registrado o que no le interesa, responde con cortesía y breve.

Devuelve SOLO un objeto JSON válido, sin texto alrededor:
{"reply":"tu mensaje de WhatsApp","intent":"greeting|question|interested|objection|register_intent|not_interested|complaint|human_request|other","needsHuman":false,"reason":"1 frase: por qué respondes así o por qué escalas","confidence":0-100}`
}

async function callClaude(system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Claude error')
  return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
}

// Genera la siguiente respuesta del agente para un hilo de conversación.
// `history` va en orden cronológico; el último mensaje debe ser entrante ('in').
export async function generateReply(
  provider: ConvProvider,
  history: ConvMessage[],
): Promise<ConvDecision> {
  // Mapear el hilo al formato de la API: 'in' (proveedor) → user, 'out' (IA) → assistant
  const messages = history.map(m => ({
    role: (m.direction === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.body,
  }))
  // La API exige que el primer mensaje sea 'user'. Si el hilo empieza por
  // un mensaje nuestro ('out'), lo prefijamos con un turno de contexto.
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: '(El proveedor ha respondido a nuestro primer contacto.)' })
  }

  const text = await callClaude(systemPrompt(provider), messages)

  let parsed: any = null
  const match = text.match(/\{[\s\S]*\}/)
  if (match) { try { parsed = JSON.parse(match[0]) } catch {} }

  // Fallback seguro: si no se pudo parsear, escalamos a humano.
  if (!parsed || typeof parsed.reply !== 'string') {
    return {
      reply: '',
      intent: 'other',
      needsHuman: true,
      autosend: false,
      reason: 'No se pudo generar una respuesta fiable — se escala a revisión humana.',
      confidence: 0,
    }
  }

  const needsHuman = parsed.needsHuman === true
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50
  // Auto-enviar solo si la IA no marca intervención humana y tiene confianza.
  const autosend = !needsHuman && confidence >= 55 && !!parsed.reply.trim()

  return {
    reply: parsed.reply.trim(),
    intent: parsed.intent || 'other',
    needsHuman,
    autosend,
    reason: parsed.reason || '',
    confidence,
  }
}
