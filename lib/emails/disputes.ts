/**
 * Avisos por email del ciclo de disputas de tarjeta.
 *
 * La alerta de apertura es urgente de verdad: Stripe da un plazo corto
 * (evidence_due_by, normalmente entre 7 y 21 días) y pasado ese momento
 * la evidencia ya no se puede enviar. Por eso el email lleva el importe,
 * la cuenta atrás y el enlace directo a la vista de la disputa.
 */

import { sendEmail } from '@/lib/resend'

const ALERT_TO = process.env.DISPUTES_ALERT_EMAIL || 'contacto@fiestago.es'

const EUR = (cents: number | null | undefined, currency = 'eur') =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
    minimumFractionDigits: 2,
  }).format((Number(cents || 0)) / 100)

const dateTimeEs = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '—'

const safe = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es'

export type DisputeAlertInput = {
  disputeId: string
  amount: number | null
  currency: string | null
  reason: string | null
  evidenceDueBy: string | null
  bookingId: string | null
  clientName?: string | null
  eventDate?: string | null
  providerName?: string | null
  /** Resultado de la compilación automática de evidencia. */
  evidenceAttached: boolean
  evidenceErrors?: string[]
  hasServiceConfirmation?: boolean
}

export async function emailAdminDisputeOpened(input: DisputeAlertInput) {
  const url = `${APP_URL}/admin/disputas?dispute=${encodeURIComponent(input.disputeId)}`
  const hoursLeft = input.evidenceDueBy
    ? Math.max(0, Math.round((new Date(input.evidenceDueBy).getTime() - Date.now()) / 3_600_000))
    : null

  const subject = `🚨 Disputa abierta · ${EUR(input.amount, input.currency || 'eur')} · responder antes del ${input.evidenceDueBy ? new Date(input.evidenceDueBy).toLocaleDateString('es-ES') : 'plazo de Stripe'}`

  const statusLine = input.evidenceAttached
    ? 'La evidencia se ha compilado y adjuntado automáticamente como BORRADOR (no enviada). Revísala y envíala tú.'
    : 'No se ha podido adjuntar la evidencia automáticamente. Hay que compilarla a mano desde el panel.'

  const text = `Disputa de tarjeta abierta

Importe: ${EUR(input.amount, input.currency || 'eur')}
Motivo Stripe: ${input.reason || '—'}
Fecha límite para enviar evidencia: ${dateTimeEs(input.evidenceDueBy)}${hoursLeft !== null ? ` (quedan ~${hoursLeft} h)` : ''}
Reserva: ${input.bookingId || 'no identificada'}
Cliente: ${input.clientName || '—'}
Proveedor: ${input.providerName || '—'}
Fecha del evento: ${input.eventDate || '—'}
Confirmación de servicio del proveedor: ${input.hasServiceConfirmation ? 'SÍ' : 'NO — punto débil de este expediente'}

${statusLine}
${input.evidenceErrors?.length ? `\nErrores al adjuntar:\n- ${input.evidenceErrors.join('\n- ')}` : ''}

Ver la disputa: ${url}

Stripe envía la evidencia automáticamente al llegar la fecha límite, así que lo peor que puede pasar es que se envíe el borrador. Lo mejor: revisarlo antes.`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 34px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#DC2626;margin-bottom:12px;">🚨 Disputa de tarjeta abierta</div>
          <div style="font-family:Georgia,serif;font-size:34px;color:#1A1612;line-height:1;margin-bottom:10px;">${EUR(input.amount, input.currency || 'eur')}</div>
          <div style="font-size:13px;color:#5C534A;">Motivo declarado: <strong>${safe(input.reason || '—')}</strong></div>
        </td></tr>
        <tr><td style="padding:20px 34px 8px;">
          <div style="background:#FEE2E2;border:1px solid #DC262633;border-radius:10px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#DC2626;margin-bottom:6px;">Fecha límite para la evidencia</div>
            <div style="font-size:15px;color:#1A1612;font-weight:bold;">${dateTimeEs(input.evidenceDueBy)}</div>
            ${hoursLeft !== null ? `<div style="font-size:12px;color:#5C534A;margin-top:4px;">Quedan aproximadamente ${hoursLeft} horas</div>` : ''}
          </div>
        </td></tr>
        <tr><td style="padding:14px 34px 4px;font-size:13px;color:#5C534A;line-height:1.7;">
          <div><strong>Reserva:</strong> ${safe(input.bookingId || 'no identificada')}</div>
          <div><strong>Cliente:</strong> ${safe(input.clientName || '—')}</div>
          <div><strong>Proveedor:</strong> ${safe(input.providerName || '—')}</div>
          <div><strong>Evento:</strong> ${safe(input.eventDate || '—')}</div>
          <div><strong>Confirmación del proveedor:</strong> ${input.hasServiceConfirmation
            ? '<span style="color:#047857;font-weight:bold;">sí, registrada</span>'
            : '<span style="color:#DC2626;font-weight:bold;">no consta — punto débil</span>'}</div>
        </td></tr>
        <tr><td style="padding:14px 34px 4px;">
          <div style="background:${input.evidenceAttached ? '#ECFDF5' : '#FEF3C7'};border:1px solid ${input.evidenceAttached ? '#04785733' : '#D9744133'};border-radius:10px;padding:14px 16px;font-size:13px;color:#1A1612;line-height:1.6;">
            ${safe(statusLine)}
            ${input.evidenceErrors?.length ? `<div style="margin-top:8px;font-size:12px;color:#B91C1C;">${input.evidenceErrors.map(e => `· ${safe(e)}`).join('<br>')}</div>` : ''}
          </div>
        </td></tr>
        <tr><td style="padding:18px 34px 30px;text-align:center;">
          <a href="${url}" style="display:inline-block;background:#DC2626;color:#fff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">Revisar la evidencia →</a>
        </td></tr>
        <tr><td style="padding:16px 34px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          La evidencia queda guardada como borrador. Stripe la envía sola al llegar la fecha límite; puedes enviarla antes desde el panel.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: ALERT_TO, subject, text, html })
}

/** Cambios de estado posteriores (updated / closed / funds_withdrawn). */
export async function emailAdminDisputeUpdated(input: {
  disputeId: string
  bookingId: string | null
  status: string | null
  outcome?: string | null
  amount: number | null
  currency: string | null
  event: string
}) {
  const url = `${APP_URL}/admin/disputas?dispute=${encodeURIComponent(input.disputeId)}`
  const won  = input.status === 'won'
  const lost = input.status === 'lost' || input.event === 'charge.dispute.funds_withdrawn'

  const subject = won
    ? `✅ Disputa ganada · ${EUR(input.amount, input.currency || 'eur')}`
    : lost
      ? `❌ Disputa perdida · ${EUR(input.amount, input.currency || 'eur')}`
      : `ℹ️ Disputa actualizada (${input.status || input.event}) · ${EUR(input.amount, input.currency || 'eur')}`

  const text = `${subject}

Evento Stripe: ${input.event}
Estado: ${input.status || '—'}
Reserva: ${input.bookingId || 'no identificada'}

Detalle: ${url}`

  return sendEmail({ to: ALERT_TO, subject, text })
}
