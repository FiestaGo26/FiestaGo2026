/**
 * Avisos por WhatsApp al cliente.
 *
 * Meta solo permite iniciar conversación en frío con una plantilla
 * aprobada, así que estos envíos requieren tener creada la plantilla y
 * declarada en env. Si falta, la función no revienta: devuelve un error
 * y el cron sigue con el email, que es el canal principal.
 *
 * Cada envío se registra en whatsapp_messages. Esa traza es parte de la
 * evidencia: en una disputa por el anticipo perdido, poder demostrar que
 * avisamos al cliente por dos canales antes de cancelar vale más que
 * cualquier argumento.
 */

import { createAdminClient } from '@/lib/supabase'
import { isValidPhoneE164ES, normalizePhone, sendTemplate } from '@/lib/whatsapp'

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0)

const dateEs = (d: string | Date | null | undefined) =>
  d ? new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d)
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

export type WhatsappSendResult = { ok: boolean; id?: string; error?: string }

/**
 * Recordatorio del segundo pago con enlace al checkout del saldo.
 *
 * Plantilla esperada (WHATSAPP_SECOND_PAYMENT_TEMPLATE), con cuatro
 * parámetros de cuerpo:
 *   {{1}} nombre · {{2}} importe · {{3}} fecha límite · {{4}} enlace de pago
 *
 * El enlace va como parámetro de texto para que el cliente pague
 * on-session: nunca cargamos el segundo plazo a la tarjeta guardada.
 */
export async function whatsappSecondPaymentReminder(
  booking: any,
  variant: 'd7' | 'd3' | 'd0' | 'overdue',
): Promise<WhatsappSendResult> {
  const template = process.env.WHATSAPP_SECOND_PAYMENT_TEMPLATE
  if (!template) return { ok: false, error: 'WHATSAPP_SECOND_PAYMENT_TEMPLATE no configurada' }

  const phone = normalizePhone(booking?.client_phone)
  if (!phone || !isValidPhoneE164ES(phone)) {
    return { ok: false, error: 'El cliente no tiene un móvil válido' }
  }

  const firstName = String(booking.client_name || '').split(' ')[0] || 'hola'
  const amount    = Number(booking.second_payment_amount || 0)
  const payUrl    = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es'}/pago-restante/${booking.id}?email=${encodeURIComponent(booking.client_email || '')}`

  try {
    const waId = await sendTemplate(phone, {
      template,
      bodyParams: [firstName, EUR(amount), dateEs(booking.second_payment_due_date), payUrl],
    })
    await logWhatsapp({
      waId,
      to: phone,
      body: `[recordatorio ${variant} segundo pago · ${EUR(amount)} · vence ${dateEs(booking.second_payment_due_date)} · ${payUrl}]`,
    })
    return { ok: true, id: waId }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error enviando el WhatsApp' }
  }
}

async function logWhatsapp(opts: { waId: string; to: string; body: string }) {
  try {
    const supabase = createAdminClient()
    await supabase.from('whatsapp_messages').insert({
      wa_message_id: opts.waId || null,
      direction:     'outbound',
      from_number:   process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      to_number:     opts.to,
      type:          'template',
      body:          opts.body,
      status:        'sent',
    })
  } catch (err: any) {
    console.error('[whatsapp-notify] no se pudo registrar el envío:', err?.message)
  }
}
