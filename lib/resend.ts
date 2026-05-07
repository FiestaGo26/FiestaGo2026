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
    .map(p => {
      // Orden correcto: escapar HTML primero, luego convertir saltos a <br>
      const safe = p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>')
      return `<p style="margin:0 0 14px 0;line-height:1.6;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1A1612;">${safe}</p>`
    })
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

  const profileUrl = `https://fiestago.es/proveedores/${provider.slug || provider.id}`
  const panelUrl   = `https://fiestago.es/proveedor/login`

  const subject = `Bienvenido a FiestaGo, ${provider.name}`

  // Versión texto plano para clientes que no soporten HTML
  const text = [
    `Enhorabuena ${provider.name},`,
    ``,
    `Tu perfil ha sido aprobado y ya está visible en FiestaGo. A partir de ahora podrás recibir solicitudes de reserva de clientes que celebran sus eventos en ${provider.city}.`,
    ``,
    `· Tu perfil ya aparece en el marketplace`,
    `· Primera transacción sin comisión (0%)`,
    `· Después solo el 8% por venta cerrada`,
    `· Sin permanencia ni cuotas mensuales`,
    ``,
    `Ver tu perfil:`,
    profileUrl,
    ``,
    `Acceder al panel del proveedor:`,
    panelUrl,
    ``,
    `Si necesitas algo, escríbenos a contacto@fiestago.es.`,
    ``,
    `Un abrazo,`,
    `El equipo de FiestaGo`,
  ].join('\n')

  // HTML elegante (editorial, paleta cream/gold)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF9F4;font-family:Helvetica,Arial,sans-serif;color:#1A1612;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF9F4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border:1px solid #EFE8DA;">

        <tr><td style="padding:28px 32px 24px;border-bottom:1px solid #EFE8DA;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;letter-spacing:0.02em;color:#1A1612;">
            FiestaGo<span style="color:#B8956A;">.</span>
          </div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#B8956A;margin-top:6px;font-weight:500;">
            Bienvenida a la familia
          </div>
        </td></tr>

        <tr><td style="padding:32px 32px 12px;">
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:400;color:#1A1612;">
            Enhorabuena, <em style="font-style:italic;color:#B8956A;">${(provider.name || '').replace(/</g, '&lt;')}</em>
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#5C534A;">
            Tu perfil ha sido aprobado y ya está visible en FiestaGo. A partir de ahora recibirás solicitudes de reserva de clientes que celebran sus eventos en <strong style="color:#1A1612;">${(provider.city || 'tu ciudad').replace(/</g, '&lt;')}</strong>.
          </p>
        </td></tr>

        <tr><td style="padding:8px 32px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #EFE8DA;border-bottom:1px solid #EFE8DA;">
            ${[
              ['Tu perfil ya aparece en el marketplace'],
              ['Primera transacción sin comisión (0%)'],
              ['Después, solo el 8% por venta cerrada'],
              ['Sin permanencia ni cuotas mensuales'],
            ].map(([t]) => `<tr><td style="padding:14px 0;border-bottom:1px solid #F2EDE2;font-size:14px;color:#1A1612;">
              <span style="color:#B8956A;font-weight:700;margin-right:10px;">·</span> ${t}
            </td></tr>`).join('')}
          </table>
        </td></tr>

        <tr><td style="padding:8px 32px 28px;text-align:center;">
          <a href="${profileUrl}" style="display:inline-block;background:#1A1612;color:#FBF9F4;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;padding:14px 30px;border-radius:999px;margin:8px 4px;">Ver mi perfil →</a>
          <a href="${panelUrl}" style="display:inline-block;background:#FFFFFF;color:#1A1612;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;padding:14px 30px;border-radius:999px;border:1px solid #1A1612;margin:8px 4px;">Acceder al panel</a>
        </td></tr>

        <tr><td style="padding:24px 32px;border-top:1px solid #EFE8DA;background:#FBF9F4;">
          <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5C534A;">
            Si tienes cualquier duda, escríbenos a <a href="mailto:contacto@fiestago.es" style="color:#B8956A;text-decoration:none;border-bottom:1px solid #D4B895;">contacto@fiestago.es</a>.
          </p>
          <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;color:#1A1612;">
            Un abrazo, el equipo de FiestaGo.
          </p>
        </td></tr>

        <tr><td style="padding:18px 32px;background:#1A1612;text-align:center;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
            FiestaGo · Marketplace de celebraciones · España
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: provider.email, subject, text, html })
}

export async function emailProviderRejection(provider: any, reason?: string) {
  if (!provider.email) return { ok: false, error: 'Proveedor sin email' }
  const subject = `Tu solicitud en FiestaGo`

  const text = [
    `Hola ${provider.name},`,
    ``,
    `Gracias por tu interés en FiestaGo. Tras revisar tu perfil, lamentablemente no podemos aprobarlo en este momento.`,
    ...(reason ? [``, `Motivo: ${reason}`] : []),
    ``,
    `Te invitamos a actualizar tu información (descripción más detallada, fotos de calidad, datos de contacto verificables) y volver a registrarte. Estaremos encantados de revisar tu solicitud nuevamente.`,
    ``,
    `Vuelve a registrarte aquí:`,
    `https://fiestago.es/registro-proveedor`,
    ``,
    `Si tienes dudas, escríbenos a contacto@fiestago.es.`,
    ``,
    `Saludos,`,
    `El equipo de FiestaGo`,
  ].join('\n')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBF9F4;font-family:Helvetica,Arial,sans-serif;color:#1A1612;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border:1px solid #EFE8DA;">
        <tr><td style="padding:28px 32px 24px;border-bottom:1px solid #EFE8DA;">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:#1A1612;">FiestaGo<span style="color:#B8956A;">.</span></div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:26px;line-height:1.2;font-weight:400;color:#1A1612;">
            Hola ${(provider.name || '').replace(/</g, '&lt;')},
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#5C534A;">
            Gracias por tu interés en FiestaGo. Tras revisar tu perfil, lamentablemente <strong style="color:#1A1612;">no podemos aprobarlo en este momento</strong>.
          </p>
          ${reason ? `<div style="background:#FBF9F4;border-left:3px solid #B8956A;padding:14px 18px;margin:18px 0;font-size:14px;line-height:1.5;color:#5C534A;font-style:italic;">${reason.replace(/</g, '&lt;')}</div>` : ''}
          <p style="margin:18px 0 24px;font-size:15px;line-height:1.65;color:#5C534A;">
            Te invitamos a actualizar tu información (descripción más detallada, fotos de calidad, datos de contacto verificables) y volver a registrarte. Estaremos encantados de revisar tu solicitud nuevamente.
          </p>
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="https://fiestago.es/registro-proveedor" style="display:inline-block;background:#1A1612;color:#FBF9F4;text-decoration:none;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;padding:14px 30px;border-radius:999px;">Volver a registrarme →</a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#1A1612;text-align:center;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">contacto@fiestago.es</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: provider.email, subject, text, html })
}
