/**
 * Emails del ciclo del segundo pago (bookings con anticipo + resto 2m antes).
 *
 * Los envía el cron /api/cron/second-payment-reminders cada día. Cada
 * función es idempotente por diseño — el cron marca el timestamp en la
 * fila del booking antes de llamarlas para no duplicar envíos.
 */

import { sendEmail } from '@/lib/resend'

const EUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n)

const dateEs = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const safe = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const PAY_URL = (booking: any) =>
  `https://fiestago.es/pago-restante/${booking.id}?email=${encodeURIComponent(booking.client_email || '')}`

// ─── Recordatorio del segundo pago · variantes D-7, D-3, D0, overdue ─────────
export async function emailClientSecondPaymentReminder(
  booking: any,
  provider: any,
  variant: 'd7' | 'd3' | 'd0' | 'overdue',
) {
  if (!booking?.client_email) return { ok: false, error: 'Cliente sin email' }

  const firstName = (booking.client_name || '').split(' ')[0] || ''
  const amount    = Number(booking.second_payment_amount || 0)
  const dueDate   = booking.second_payment_due_date
  const eventDate = booking.event_date

  const conf: Record<string, {
    subject: string
    eyebrow: string
    color:   string
    bg:      string
    headline: string
    body:    string
  }> = {
    d7: {
      subject:  `Recordatorio · pago restante en 7 días · ${dateEs(eventDate)}`,
      eyebrow:  '⏰ FALTAN 7 DÍAS',
      color:    '#D9A441',
      bg:       '#FEF7E6',
      headline: `${firstName}, tu segundo pago vence en 7 días`,
      body:     `En 7 días (el <strong>${dateEs(dueDate)}</strong>) vence el segundo pago de tu reserva con ${safe(provider?.name || 'tu proveedor')} para el evento del ${dateEs(eventDate)}. Puedes pagarlo ya para dejarlo cerrado.`,
    },
    d3: {
      subject:  `Recordatorio · pago restante en 3 días · ${dateEs(eventDate)}`,
      eyebrow:  '⏰ FALTAN 3 DÍAS',
      color:    '#E8553E',
      bg:       '#FEEEE7',
      headline: `${firstName}, tu segundo pago vence en 3 días`,
      body:     `En 3 días (el <strong>${dateEs(dueDate)}</strong>) vence el segundo pago de tu reserva. Es imprescindible tener el importe completo pagado con al menos 2 meses de antelación al evento para que la Garantía de Éxito quede activa.`,
    },
    d0: {
      subject:  `⚠️ Hoy vence tu pago restante · ${dateEs(eventDate)}`,
      eyebrow:  '⏰ VENCE HOY',
      color:    '#DC2626',
      bg:       '#FEE2E2',
      headline: `${firstName}, hoy vence tu segundo pago`,
      body:     `Hoy es la fecha límite del segundo pago de tu reserva. Pásate por el enlace para completarlo — tienes 7 días de gracia, pero pasados esos días la reserva se cancelará automáticamente y perderás el anticipo ya abonado.`,
    },
    overdue: {
      subject:  `⚠️ Pago vencido · tu reserva puede cancelarse · ${dateEs(eventDate)}`,
      eyebrow:  '⚠️ PAGO VENCIDO',
      color:    '#DC2626',
      bg:       '#FEE2E2',
      headline: `${firstName}, tu segundo pago está vencido`,
      body:     `El segundo pago de tu reserva venció el ${dateEs(dueDate)}. Tienes hasta ${dateEs(new Date(Date.now() + 7 * 86400000))} para completarlo — pasada esa fecha la reserva se cancelará automáticamente y el anticipo abonado se destinará a tu proveedor como compensación por perder la fecha.`,
    },
  }

  const c = conf[variant]

  const text = `Hola ${firstName},

${c.body.replace(/<[^>]+>/g, '')}

Importe pendiente: ${EUR(amount)}
Enlace para pagar: ${PAY_URL(booking)}

Cualquier duda, responde a este email.

El equipo de FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:${c.color};margin-bottom:14px;">${c.eyebrow}</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;color:#1A1612;line-height:1.25;">${safe(c.headline)}</h1>
          <p style="margin:0;font-size:14.5px;color:#5C534A;line-height:1.55;">${c.body}</p>
        </td></tr>
        <tr><td style="padding:24px 36px 12px;">
          <div style="background:${c.bg};border:1px solid ${c.color}33;border-radius:10px;padding:16px 18px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:${c.color};margin-bottom:8px;">Importe pendiente</div>
            <div style="font-family:Georgia,serif;font-size:32px;color:#1A1612;line-height:1;">${EUR(amount)}</div>
            <div style="font-size:12px;color:#5C534A;margin-top:8px;">Reserva con ${safe(provider?.name || 'tu proveedor')} · evento el ${dateEs(eventDate)}</div>
          </div>
        </td></tr>
        <tr><td style="padding:16px 36px 32px;text-align:center;">
          <a href="${PAY_URL(booking)}" style="display:inline-block;background:${c.color};color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">Completar el pago →</a>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">FiestaGo · Garantía de Éxito activa</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({
    to: booking.client_email,
    cc: booking.planner_email || undefined,
    subject: c.subject, text, html,
  })
}

// ─── Reserva cancelada automáticamente por impago del segundo pago ───────────
export async function emailClientReservationCancelledByNonpayment(booking: any, provider: any) {
  if (!booking?.client_email) return { ok: false, error: 'Cliente sin email' }

  const firstName = (booking.client_name || '').split(' ')[0] || ''
  const anticipo = Number(booking.first_payment_amount || 0)

  const subject = `Reserva cancelada por impago · ${dateEs(booking.event_date)}`
  const text = `Hola ${firstName},

Lamentablemente hemos tenido que cancelar tu reserva con ${provider?.name || 'tu proveedor'} para el evento del ${dateEs(booking.event_date)} porque el segundo pago no se completó dentro del plazo de gracia.

El anticipo de ${EUR(anticipo)} ya abonado se destina al proveedor como compensación por haber reservado la fecha, según los Términos de Uso que aceptaste al reservar.

Si esto es un error o quieres reservar de nuevo, escríbenos a contacto@fiestago.es.

El equipo de FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin-bottom:14px;">Reserva cancelada</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;color:#1A1612;">${safe(firstName)}, tu reserva se ha cancelado</h1>
          <p style="margin:0;font-size:14.5px;color:#5C534A;line-height:1.55;">
            El segundo pago de tu reserva con ${safe(provider?.name || 'tu proveedor')} para el evento del <strong>${dateEs(booking.event_date)}</strong> no se completó dentro del plazo de gracia de 7 días.
            El anticipo de <strong>${EUR(anticipo)}</strong> se destina al proveedor como compensación por haber reservado la fecha.
          </p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">¿Un error? Escríbenos a contacto@fiestago.es</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({
    to: booking.client_email,
    cc: booking.planner_email || undefined,
    subject, text, html,
  })
}

// ─── Proveedor: reserva cancelada por impago del cliente, fecha liberada ─────
export async function emailProviderReservationCancelledByNonpayment(booking: any, provider: any) {
  if (!provider?.email) return { ok: false, error: 'Proveedor sin email' }

  const anticipo = Number(booking.first_payment_amount || 0)
  const subject = `Reserva cancelada por impago del cliente · fecha ${dateEs(booking.event_date)} liberada`

  const text = `Hola ${provider?.name || ''},

La reserva de ${booking.client_name || 'un cliente'} para el ${dateEs(booking.event_date)} se ha cancelado automáticamente porque el cliente no completó el segundo pago dentro del plazo de gracia de 7 días.

La fecha vuelve a estar disponible en tu calendario.

Compensación por perder la fecha: el anticipo de ${EUR(anticipo)} que el cliente pagó al reservar te será abonado según el calendario de payouts.

Un saludo,
FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#DC2626;margin-bottom:14px;">Reserva cancelada · impago del cliente</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;color:#1A1612;line-height:1.25;">La fecha del ${dateEs(booking.event_date)} vuelve a estar disponible</h1>
          <p style="margin:0 0 16px;font-size:14.5px;color:#5C534A;line-height:1.55;">
            ${safe(booking.client_name || 'El cliente')} no completó el segundo pago dentro del plazo de gracia de 7 días, así que la reserva se ha cancelado automáticamente.
          </p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 16px;font-size:13.5px;color:#065F46;">
            <strong>Compensación por perder la fecha:</strong> el anticipo de <strong>${EUR(anticipo)}</strong> que el cliente abonó al reservar te será abonado según el calendario de payouts.
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">FiestaGo · Cualquier duda: contacto@fiestago.es</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: provider.email, subject, text, html })
}
