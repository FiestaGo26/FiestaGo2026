// ───────────────────────────────────────────────────────────────────────
// Asistente de WhatsApp para CLIENTES fuera del horario humano.
//
// De lunes a viernes de 10:00 a 20:00 (Madrid) contesta una persona: el
// cliente recibe un acuse de recibo y Mariano un email. Fuera de ese
// horario contesta este asistente, con datos cerrados de FiestaGo y sin
// comprometer nada que no pueda cumplir (precios, disponibilidad,
// reservas): para eso remite a la web o a la persona del equipo.
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.CLIENT_ASSISTANT_MODEL || 'claude-sonnet-5-5'

export const HUMAN_HOURS = 'de lunes a viernes de 10:00 a 20:00 y los sábados de 10:00 a 14:00'

/** ¿Hay una persona atendiendo ahora? (L-V 10-20 y sábado 10-14, hora de Madrid) */
export function isHumanHours(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(now)
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const weekday = parts.find(p => p.type === 'weekday')?.value || ''
  if (weekday === 'Sun') return false
  if (weekday === 'Sat') return hour >= 10 && hour < 14
  return hour >= 10 && hour < 20
}

const SYSTEM = `Eres el asistente de WhatsApp de FiestaGo (fiestago.es), un marketplace de proveedores para bodas, comuniones, bautizos, cumpleaños infantiles y de adultos, despedidas y eventos de empresa en toda España. Atiendes a CLIENTES (personas que organizan una celebración) fuera del horario en que responde una persona del equipo (${HUMAN_HOURS}).

Lo que es verdad y puedes contar:
- En fiestago.es se buscan proveedores por servicio y ciudad (fotografía, catering, música/DJ, animación, tartas, flores, decoración, planner, belleza, transporte…), cada uno con su precio cerrado a la vista. También hay packs y un quiz de 2 minutos (fiestago.es/quiz) que orienta qué necesitas.
- Todos los servicios llevan la Garantía de Éxito incluida en el precio: si el proveedor cancela, se busca un sustituto que cumpla las mismas funciones a un precio similar en 48 h y, si no lo hay, se devuelve el 110 % de lo pagado; si no se presenta el día del evento, se devuelve lo pagado más una compensación según el importe de la reserva (300 € hasta 500 €; 500 € de 500 a 2.000 €; 1.000 € de 2.000 a 5.000 €; 2.000 € de 5.000 a 15.000 €; 3.000 € por encima). El 110 % es todo lo pagado y un 10 % más por las molestias. Los reembolsos se hacen en un máximo de 5 días hábiles. No cubre lluvia o clima, cambios pedidos por el cliente ni insatisfacción subjetiva. Detalles: fiestago.es/garantia.
- El pago queda retenido en Stripe, una entidad de pagos regulada, y el proveedor no cobra hasta que termina el evento.
- Los proveedores se verifican (DNI o CIF y seguro de responsabilidad civil) antes de publicarse.
- Detrás está Mariano González, el fundador (fiestago.es/quienes-somos).

Reglas:
- Respuestas cortas (2-5 frases), cercanas, en español de España, tuteando. Sin listas largas ni markdown; como mucho un emoji.
- No inventes precios, disponibilidad, nombres de proveedores, reseñas ni plazos que no estén arriba. No confirmes ni gestiones reservas, cambios, cancelaciones ni reembolsos: di que una persona del equipo lo revisa en horario (${HUMAN_HOURS}).
- Para ayudar, pregunta qué celebra, la fecha, la ciudad y para cuántas personas, y orienta a buscar en fiestago.es o hacer el quiz.
- Si el mensaje es de un profesional que quiere darse de alta, remítelo a fiestago.es/profesionales.
- Si no sabes algo, dilo y explica que una persona le contesta en horario.
- Nunca digas que eres una persona. Si te preguntan, eres el asistente automático de FiestaGo.`

export type ClientTurn = { role: 'user' | 'assistant'; text: string }

export async function generateClientReply(history: ClientTurn[]): Promise<string> {
  // La API exige alternar turnos y empezar por el usuario: fusionamos seguidos
  const turns: ClientTurn[] = []
  for (const t of history) {
    if (!t.text) continue
    const last = turns[turns.length - 1]
    if (last && last.role === t.role) last.text += `\n${t.text}`
    else turns.push({ ...t })
  }
  while (turns.length && turns[0].role !== 'user') turns.shift()
  if (!turns.length) throw new Error('Sin mensajes del cliente')

  const resp = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: turns.slice(-20).map(t => ({ role: t.role, content: t.text })),
  })
  return resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
}
