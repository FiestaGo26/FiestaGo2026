/**
 * Recordatorio al proveedor para que confirme que prestó el servicio.
 *
 * Se envía 24 h después del evento si no hay confirmación. No es
 * burocracia: una reserva sin confirmación es la que perdemos si el
 * cliente reclama a su banco dentro de cuatro meses, y el plazo de
 * reclamación cuenta desde la fecha del servicio, no desde el cobro.
 */

import { sendEmail } from '@/lib/resend'

const dateEs = (d: string | Date | null | undefined) =>
  d ? new Date(typeof d === 'string' && d.length === 10 ? d + 'T00:00:00' : d)
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

const safe = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es'

export async function emailProviderConfirmServiceReminder(booking: any, provider: any) {
  if (!provider?.email) return { ok: false, error: 'Proveedor sin email' }

  const panelUrl = `${APP_URL}/proveedor/panel?tab=bookings`
  const firstName = String(provider.name || '').split(' ')[0] || ''

  const subject = `Confirma que prestaste el servicio · evento del ${dateEs(booking.event_date)}`

  const text = `Hola ${firstName},

El evento de ${booking.client_name} del ${dateEs(booking.event_date)} ya ha pasado y todavía no has confirmado en tu panel que prestaste el servicio.

Entra en tu panel → Reservas y pulsa "Confirmar servicio prestado". Te lleva 5 segundos.

${panelUrl}

¿Por qué importa? El cliente puede reclamar el cargo a su banco hasta 4 meses después del evento. Tu confirmación, con su fecha y hora, es la prueba que presentamos para defender el cobro. Sin ella, esa reclamación se pierde — y con ella, tu cobro.

Si hubo cualquier problema con el servicio, respóndenos a este email antes de confirmar.

El equipo de FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:34px 34px 22px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#047857;margin-bottom:12px;">✓ Confirma el servicio</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:23px;color:#1A1612;line-height:1.25;">${safe(firstName)}, ¿todo bien en el evento del ${dateEs(booking.event_date)}?</h1>
          <p style="margin:0;font-size:14.5px;color:#5C534A;line-height:1.55;">
            El evento de <strong>${safe(booking.client_name || 'tu cliente')}</strong> ya ha pasado y aún no has confirmado en tu panel que prestaste el servicio.
          </p>
        </td></tr>
        <tr><td style="padding:22px 34px 6px;">
          <div style="background:#ECFDF5;border:1px solid #04785733;border-radius:10px;padding:16px 18px;font-size:13.5px;color:#1A1612;line-height:1.6;">
            <strong>Por qué te lo pedimos:</strong> el cliente puede reclamar el cargo a su banco hasta 4 meses después del evento.
            Tu confirmación, con fecha y hora, es la prueba con la que defendemos el cobro. Sin ella esa reclamación se pierde, y con ella tu dinero.
          </div>
        </td></tr>
        <tr><td style="padding:20px 34px 32px;text-align:center;">
          <a href="${panelUrl}" style="display:inline-block;background:#047857;color:#fff;padding:14px 30px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">Confirmar servicio prestado →</a>
          <div style="font-size:12px;color:#8A7968;margin-top:14px;">Panel → Reservas → "Confirmar servicio prestado"</div>
        </td></tr>
        <tr><td style="padding:16px 34px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          ¿Hubo algún problema en el evento? Respóndenos a este email antes de confirmar.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: provider.email, subject, text, html })
}
