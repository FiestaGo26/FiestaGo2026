// Helpers de envío de emails via Resend.
// Requiere RESEND_API_KEY, OUTREACH_FROM, OUTREACH_FROM_NAME, OUTREACH_REPLY_TO en env.

const RESEND_API = 'https://api.resend.com/emails'

function fromHeader() {
  const name = process.env.OUTREACH_FROM_NAME || 'FiestaGo'
  const addr = process.env.OUTREACH_FROM || 'contacto@fiestago.es'
  return `${name} <${addr}>`
}

function paragraphsToHtml(text: string): string {
  return text
    .split(/\r?\n\r?\n/)
    .map(p => `<p style="margin:0 0 14px 0;line-height:1.6;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1A1612;">${
      p.replace(/\r?\n/g, '<br>')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }</p>`)
    .join('')
}

async function sendEmail(opts: {
  to: string | string[]
  subject: string
  text: string
  html?: string
  reply_to?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' }

  const html = opts.html || paragraphsToHtml(opts.text)
  const reply_to = opts.reply_to || process.env.OUTREACH_REPLY_TO || undefined

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    fromHeader(),
        to:      Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        text:    opts.text,
        html,
        reply_to,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as any)?.message || `HTTP ${res.status}` }
    return { ok: true, id: (data as any)?.id }
  } catch (err: any) {
    return { ok: false, error: err.message || 'fetch error' }
  }
}

// ── PLANTILLAS ────────────────────────────────────────────────────

export async function emailAdminNewProvider(provider: any) {
  const adminEmail = process.env.ADMIN_EMAIL || 'contacto@fiestago.es'
  const subject = `🆕 Nuevo proveedor pendiente · ${provider.name}`
  const text = `Hola,

Un nuevo proveedor se ha registrado en FiestaGo y está pendiente de revisión.

Nombre:    ${provider.name}
Categoría: ${provider.category}
Ciudad:    ${provider.city}
Email:     ${provider.email || '—'}
Teléfono:  ${provider.phone || '—'}
Web:       ${provider.website || '—'}
Instagram: ${provider.instagram || '—'}

Descripción:
${provider.description || '—'}

Revísalo en el panel admin y aprueba o rechaza:
https://fiestago.es/admin

Saludos,
FiestaGo (sistema automático)`
  return sendEmail({ to: adminEmail, subject, text })
}

export async function emailProviderWelcome(provider: any) {
  if (!provider.email) return { ok: false, error: 'Proveedor sin email' }
  const subject = `🎉 Bienvenido a FiestaGo, ${provider.name}`
  const text = `¡Enhorabuena ${provider.name}!

Tu perfil ha sido aprobado y ya está visible en FiestaGo. A partir de ahora podrás recibir solicitudes de reserva de clientes que celebran sus eventos en ${provider.city}.

✓ Tu perfil ya aparece en el marketplace
✓ Primera transacción sin comisión (0%)
✓ Después solo el 8% por venta cerrada
✓ Sin permanencia ni cuotas mensuales

Puedes ver tu perfil aquí:
https://fiestago.es/proveedores/${provider.slug || provider.id}

Y acceder a tu panel para gestionar disponibilidad y reservas:
https://fiestago.es/proveedor/login

Si necesitas algo, escríbenos a contacto@fiestago.es.

Un abrazo,
El equipo de FiestaGo`
  return sendEmail({ to: provider.email, subject, text })
}

export async function emailProviderRejection(provider: any, reason?: string) {
  if (!provider.email) return { ok: false, error: 'Proveedor sin email' }
  const subject = `Tu solicitud en FiestaGo`
  const text = `Hola ${provider.name},

Gracias por tu interés en FiestaGo. Tras revisar tu perfil, lamentablemente no podemos aprobarlo en este momento.

${reason ? `Motivo: ${reason}\n\n` : ''}Te invitamos a actualizar tu información (descripción más detallada, fotos de calidad, datos de contacto verificables) y volver a registrarte. Estaremos encantados de revisar tu solicitud nuevamente.

Para volver a registrarte:
https://fiestago.es/registro-proveedor

Si tienes dudas, escríbenos a contacto@fiestago.es.

Saludos,
El equipo de FiestaGo`
  return sendEmail({ to: provider.email, subject, text })
}
