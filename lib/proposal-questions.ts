// ───────────────────────────────────────────────────────────────────────
// Preguntas del cliente desde su propuesta: quién contesta.
//
// Todo lo de la Garantía de Éxito, pagos, señal, devoluciones,
// cancelaciones, facturas y quién es FiestaGo lo contesta FiestaGo al
// momento con sus condiciones reales; el proveedor solo contesta lo de su
// servicio. (8.ª simulación: el proveedor respondía mal sobre la garantía
// —"no la incluyo"— y eso tumbaba la reserva.)
// ───────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import type { Proposal } from '@/lib/proposals'

const MODEL = process.env.CLIENT_ASSISTANT_MODEL || 'claude-sonnet-5-5'

/** Condiciones de FiestaGo para el cliente (sin el % de la Garantía). */
export const FIESTAGO_TERMS = `Condiciones de FiestaGo (son las únicas válidas; no inventes otras):
- Precio: el de la propuesta es el total que paga el cliente, con IVA y Garantía de Éxito incluidos; no hay más cargos.
- Pago: se reserva con una señal del 10-20 % del total y el resto se paga 2 meses antes del evento (si faltan menos de 2 meses, todo al reservar). El dinero queda retenido en Stripe, entidad de pagos regulada, y el proveedor no lo cobra hasta que termina el evento.
- Garantía de Éxito (incluida en todos los servicios): si el proveedor cancela, FiestaGo busca en 48 h un sustituto que cumpla las mismas funciones a un precio similar; si no lo encuentra, devuelve todo lo pagado y un 10 % más. Si el proveedor no se presenta el día, devuelve lo pagado más una compensación según el importe de la reserva: 300 € hasta 500 €; 500 € de 500 a 2.000 €; 1.000 € de 2.000 a 5.000 €; 2.000 € de 5.000 a 15.000 €; 3.000 € por encima. Reembolsos en un máximo de 5 días hábiles desde que se aprueba la incidencia. Cubre reservas de hasta 25.000 €.
- No cubre: la lluvia o el tiempo, ni los cambios que pida el propio cliente. Solo cubre lo que se reserva y paga dentro de FiestaGo.
- Reserva sin riesgo: durante los 7 días siguientes a pagar la señal (si en ese momento faltan 30 días o más para el evento), el cliente puede cancelar y se le devuelve todo lo pagado, por ejemplo si no se cierran los detalles finales (menú, boceto, horario) o cambian sus planes.
- Si cancela el cliente después de esos 7 días: se aplica la política de cancelación del servicio que aparece en la propuesta.
- Facturas: el cliente recibe la factura del servicio (a nombre del proveedor) y la de la Garantía (de FiestaGo), por email y en su cuenta.
- Quién es FiestaGo: Francisco Mariano González Tejedo, NIF 09437664M, C/ Turina 6, 33011 Oviedo. Atiende una persona por WhatsApp de lunes a viernes de 10:00 a 20:00 y sábados de 10:00 a 14:00.
- Proveedores verificados: DNI/CIF y seguro de responsabilidad civil.`

let _client: Anthropic | null = null
const client = () => (_client ||= new Anthropic())

export type QuestionRoute = { para: 'fiestago' | 'proveedor' | 'ambos'; respuesta_fiestago: string }

/** Decide quién contesta y, si toca a FiestaGo, redacta su respuesta. */
export async function routeQuestion(question: string, p: Proposal): Promise<QuestionRoute> {
  const policy = p.cancellation ? `Política de cancelación de este servicio (${p.cancellation.label}): ${p.cancellation.rules.join(' ')}` : 'Este servicio usa la política de cancelación de su ficha.'
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 1200,
    output_config: { format: { type: 'json_schema', schema: {
      type: 'object', additionalProperties: false, required: ['para', 'respuesta_fiestago'],
      properties: {
        para: { type: 'string', enum: ['fiestago', 'proveedor', 'ambos'] },
        respuesta_fiestago: { type: 'string' },
      },
    } } },
    system: `Atiendes las preguntas que un cliente hace desde su propuesta de FiestaGo. Clasifica la pregunta:
- "fiestago": garantía, pagos, señal, devoluciones, cancelaciones, facturas, IVA, seguridad del dinero o quién es FiestaGo.
- "proveedor": cualquier cosa del servicio en sí (qué incluye, horarios, menú, alergias, material, espacio, plan B, estilo, experiencia).
- "ambos": si mezcla las dos cosas.
Si es "fiestago" o "ambos", escribe en "respuesta_fiestago" la respuesta de FiestaGo a SU parte: en español de España, cercana, 1-4 frases, con las cifras exactas de estas condiciones y aplicadas a esta propuesta. Si es "ambos", termina diciendo que lo del servicio se lo has pasado a ${p.provider.name}. Si es "proveedor", deja "respuesta_fiestago" vacío.

${FIESTAGO_TERMS}
${policy}
Esta propuesta: ${p.provider.name}, total ${p.total} € (señal ${p.first_payment} €, resto ${p.second_payment} €${p.second_payment_due ? ` el ${p.second_payment_due}` : ''}).`,
    messages: [{ role: 'user', content: question }],
  } as any)
  const raw = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
  return JSON.parse(raw) as QuestionRoute
}
