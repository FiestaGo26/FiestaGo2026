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

  const profileUrl    = `https://fiestago.es/proveedores/${provider.slug || provider.id}`
  const panelUrl      = `https://fiestago.es/proveedor/login`
  const referralUrl   = `https://fiestago.es/registro-proveedor?ref=${provider.id}`
  const safeName      = (provider.name || '').replace(/</g, '&lt;')
  const safeCity      = (provider.city || 'tu ciudad').replace(/</g, '&lt;')

  const subject = `🎉 Bienvenido a FiestaGo, ${provider.name}`

  // Texto plano para clientes que no soporten HTML
  const text = [
    `Enhorabuena ${provider.name}!`,
    ``,
    `Tu perfil ha sido aprobado y ya está visible en FiestaGo.`,
    `A partir de ahora recibirás solicitudes de clientes que celebran sus eventos en ${provider.city}.`,
    ``,
    `LO QUE GANAS POR SER PARTE DE FIESTAGO:`,
    ``,
    `🎁 Primera venta sin comisión — cobras al 100% tu primera transacción.`,
    `💸 Solo 8% después — la comisión más baja del sector. Sin cuotas.`,
    `📅 Calendario inteligente — marca días libres, bloqueamos fechas reservadas.`,
    `🚀 Clientes cualificados — solicitudes serias con fecha y datos completos.`,
    `🛡 Pago seguro — cliente paga primero, tú cobras tras el servicio.`,
    `📣 Marketing gratis — te promocionamos en IG y TikTok @fiestagospain.`,
    `🏆 Sello de calidad gratis — visible junto a tu perfil si mantienes 4,5/5.`,
    ``,
    `BONUS — TRAE A UN COMPAÑERO Y SUBE`,
    `Si invitas a otro profesional y se registra, los dos apareceréis automáticamente`,
    `en los primeros puestos de vuestra categoría sin coste extra.`,
    ``,
    `Tu link de referido único (compártelo por WhatsApp, IG o email):`,
    `${referralUrl}`,
    ``,
    `---`,
    ``,
    `Próximos pasos:`,
    `1. Accede a tu panel y completa tu perfil`,
    `2. Sube tus servicios con fotos y precio cerrado`,
    `3. Marca tu disponibilidad en el calendario`,
    `4. Comparte tu link de referido para subir al top`,
    `5. ¡Espera a tu primera reserva!`,
    ``,
    `Ver mi perfil:        ${profileUrl}`,
    `Acceder a mi panel:   ${panelUrl}`,
    ``,
    `Si tienes dudas, responde a este email o escríbenos a contacto@fiestago.es.`,
    ``,
    `Un abrazo,`,
    `El equipo de FiestaGo`,
  ].join('\n')

  // HTML editorial Airbnb-style con beneficios en grid + CTAs prominentes
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1612;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #ECE3D2;">

        <!-- HERO con foto -->
        <tr><td style="padding:0;position:relative;background:#1A1612;">
          <img src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80&auto=format&fit=crop"
            alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;opacity:0.85;"/>
        </td></tr>

        <!-- Logo + Tagline -->
        <tr><td style="padding:28px 36px 0;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:500;letter-spacing:-0.01em;color:#1A1612;">
            FiestaGo<span style="color:#E8553E;">.</span>
          </div>
          <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#E8553E;margin-top:8px;font-weight:600;">
            ✨ Bienvenido a la familia
          </div>
        </td></tr>

        <!-- Welcome message -->
        <tr><td style="padding:24px 36px 18px;text-align:center;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:400;color:#1A1612;">
            Enhorabuena, <em style="font-style:italic;color:#E8553E;font-weight:300;">${safeName}</em>
          </h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#5C534A;max-width:480px;display:inline-block;">
            Tu perfil ya está visible en el marketplace y empezarás a recibir solicitudes de clientes en <strong style="color:#1A1612;">${safeCity}</strong>. Estás dentro 🎉
          </p>
        </td></tr>

        <!-- Beneficios (sección dorada destacada) -->
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FFEDE1 100%);border:1px solid #FFE1CC;border-radius:12px;padding:24px;">
            <div style="text-align:center;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;margin-bottom:18px;">
              Lo que ganas siendo parte de FiestaGo
            </div>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${[
                ['🎁', 'Primera venta sin comisión',     'Tu primera transacción la cobras al 100%. Sin costes.'],
                ['💸', 'Solo 8% después',                'La comisión más baja del sector. Sin cuotas ni permanencia.'],
                ['📅', 'Calendario inteligente',         'Marca tus días libres. Bloqueamos automáticamente las fechas ya reservadas.'],
                ['🚀', 'Clientes cualificados',          'Solo recibes solicitudes serias, con fecha y datos completos.'],
                ['🛡', 'Pago seguro',                    'El cliente paga primero. Tú cobras tras el servicio.'],
                ['📣', 'Marketing gratis para ti',       'Te promocionamos en Instagram y TikTok @fiestagospain sin coste.'],
              ].map(([icon, title, desc]) => `
                <tr><td style="padding:10px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td valign="top" width="40" style="font-size:22px;line-height:1;padding-right:14px;">${icon}</td>
                      <td valign="top">
                        <div style="font-size:15px;font-weight:700;color:#1A1612;margin-bottom:3px;line-height:1.3;">${title}</div>
                        <div style="font-size:13px;color:#5C534A;line-height:1.5;">${desc}</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              `).join('')}
            </table>
          </div>
        </td></tr>

        <!-- Sello de calidad -->
        <tr><td style="padding:12px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FBF0E0 100%);border:2px solid #C8860A;border-radius:12px;padding:22px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;line-height:1;">🏆</div>
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C8860A;font-weight:700;margin-bottom:8px;">Tu sello de calidad · GRATIS</div>
            <div style="font-size:16px;font-weight:700;color:#1A1612;margin-bottom:6px;line-height:1.3;">Ya lo tienes</div>
            <div style="font-size:13px;color:#5C534A;line-height:1.55;max-width:420px;margin:0 auto;">Aparecerá junto a tu perfil mientras mantengas <strong>4,5/5</strong> en tus reseñas. Aumenta confianza y reservas.</div>
          </div>
        </td></tr>

        <!-- Link de referido personalizado -->
        <tr><td style="padding:12px 36px 0;">
          <div style="background:linear-gradient(135deg,#FEF2EE 0%,#FCE3DC 100%);border:2px solid #E8553E;border-radius:12px;padding:22px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;line-height:1;">🤝</div>
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;font-weight:700;margin-bottom:8px;">Tu link de referido · BONUS</div>
            <div style="font-size:16px;font-weight:700;color:#1A1612;margin-bottom:6px;line-height:1.3;">Trae a un compañero y subes</div>
            <div style="font-size:13px;color:#5C534A;line-height:1.55;max-width:420px;margin:0 auto 14px;">Comparte este link por WhatsApp, Instagram o email. Cuando alguien se registre, los dos apareceréis en el <strong>top de vuestra categoría</strong>.</div>
            <div style="background:#fff;border:1px solid #FCD2C5;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:11px;color:#1A1612;word-break:break-all;">
              ${referralUrl}
            </div>
          </div>
        </td></tr>

        <!-- Próximos pasos -->
        <tr><td style="padding:28px 36px 18px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#5C534A;margin-bottom:14px;">
            ✓ Próximos pasos
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${[
              ['1', 'Accede a tu panel y completa tu perfil'],
              ['2', 'Sube tus servicios con fotos y precio cerrado'],
              ['3', 'Marca tu disponibilidad en el calendario'],
              ['4', '¡Espera a tu primera reserva! 🎊'],
            ].map(([n, t]) => `
              <tr><td style="padding:8px 0;border-bottom:1px solid #F2EDE2;font-size:14px;color:#1A1612;line-height:1.5;">
                <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#1A1612;color:#fff;border-radius:50%;font-size:11px;font-weight:700;margin-right:12px;">${n}</span>
                ${t}
              </td></tr>
            `).join('')}
          </table>
        </td></tr>

        <!-- CTA buttons -->
        <tr><td style="padding:20px 36px 36px;text-align:center;">
          <a href="${panelUrl}" style="display:inline-block;background:#E8553E;color:#FFFFFF;text-decoration:none;font-size:13px;letter-spacing:0.08em;font-weight:700;padding:15px 32px;border-radius:12px;margin:6px 4px;box-shadow:0 4px 12px rgba(232,85,62,0.25);">
            Acceder a mi panel →
          </a>
          <br/>
          <a href="${profileUrl}" style="display:inline-block;color:#1A1612;text-decoration:none;font-size:12px;letter-spacing:0.05em;font-weight:600;padding:10px 16px;margin-top:8px;border-bottom:1px solid #1A1612;">
            Ver mi perfil público
          </a>
        </td></tr>

        <!-- Soporte -->
        <tr><td style="padding:24px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;color:#1A1612;margin-bottom:10px;">
            "Estamos aquí para que vendas más"
          </div>
          <p style="margin:0;font-size:13px;line-height:1.55;color:#5C534A;">
            Si tienes cualquier duda, escríbenos a
            <a href="mailto:contacto@fiestago.es" style="color:#E8553E;text-decoration:none;font-weight:600;">contacto@fiestago.es</a>
            o responde directamente a este email.
          </p>
        </td></tr>

        <!-- Footer dark -->
        <tr><td style="padding:18px 36px;background:#1A1612;text-align:center;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
            FiestaGo · El marketplace de celebraciones · España
          </div>
        </td></tr>

      </table>

      <!-- Footer below card -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-top:18px;">
        <tr><td style="text-align:center;font-size:11px;color:#8A7968;line-height:1.6;">
          <a href="https://instagram.com/fiestagospain" style="color:#8A7968;text-decoration:none;">@fiestagospain</a>
          ·
          <a href="https://fiestago.es" style="color:#8A7968;text-decoration:none;">fiestago.es</a>
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

// ════════════════════════════════════════════════════════════════
//  RESERVAS
// ════════════════════════════════════════════════════════════════

function bookingDateF(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
  } catch { return dateStr }
}

export async function emailAdminNewBooking(booking: any, provider: any) {
  const adminEmail = process.env.ADMIN_EMAIL || 'contacto@fiestago.es'
  const subject = `💸 Nueva reserva · ${provider?.name || 'Proveedor'} · ${bookingDateF(booking.event_date)}`
  const text = `Nueva solicitud de reserva en FiestaGo.

Cliente:   ${booking.client_name}
Email:     ${booking.client_email}
Teléfono:  ${booking.client_phone || '—'}
Fecha:     ${bookingDateF(booking.event_date)}
Evento:    ${booking.event_type || 'otro'}
Invitados: ${booking.guests ?? '—'}
Ciudad:    ${booking.city || '—'}
Importe:   ${(booking.total_amount || 0).toLocaleString()}€

Proveedor:        ${provider?.name || '—'} (${provider?.city || ''})
Email proveedor:  ${provider?.email || '—'}

Mensaje del cliente:
${booking.message || '—'}

Revísalo en el panel admin: https://fiestago.es/admin

Saludos,
FiestaGo (sistema automático)`
  return sendEmail({ to: adminEmail, subject, text })
}

export async function emailProviderNewBooking(booking: any, provider: any) {
  if (!provider?.email) return { ok: false, error: 'Proveedor sin email' }

  // NUNCA incluimos datos personales del cliente en el primer email.
  // El proveedor los verá tras aceptar la reserva en el panel.
  // Limpiar el mensaje de posibles emails/teléfonos que el cliente haya dejado:
  const safeMsg = booking.message
    ? booking.message
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email oculto]')
        .replace(/\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}\b/g, '[teléfono oculto]')
    : null

  const subject = `🔔 Nueva solicitud de reserva — ${bookingDateF(booking.event_date)}`
  const text = `Hola ${provider.name},

Tienes una nueva solicitud de reserva en FiestaGo.

Fecha:     ${bookingDateF(booking.event_date)}
Evento:    ${booking.event_type || 'otro'}
Invitados: ${booking.guests ?? '—'}
Importe:   ${(booking.total_amount || 0).toLocaleString()}€

Mensaje del cliente:
${safeMsg || '(sin mensaje)'}

Los datos de contacto del cliente (nombre, email, teléfono) se mostrarán SOLO una vez aceptes la reserva, no antes. Esto protege a ambas partes y evita confusiones.

Acepta o rechaza en tu panel:
https://fiestago.es/proveedor/panel

Un saludo,
El equipo de FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#E8553E;margin-bottom:14px;">🔔 Nueva solicitud</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;color:#1A1612;line-height:1.2;">
            Hola ${(provider.name || '').replace(/</g, '&lt;')}, te quieren reservar.
          </h1>
          <p style="margin:0;font-size:15px;color:#5C534A;line-height:1.55;">
            Un cliente quiere reservar contigo a través de FiestaGo para el <strong style="color:#E8553E;">${bookingDateF(booking.event_date)}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:24px 36px;">
          <table width="100%" style="font-size:14px;color:#1A1612;">
            <tr><td style="padding:6px 0;color:#8A7968;width:120px;">📅 Fecha</td><td style="padding:6px 0;font-weight:bold;color:#E8553E;">${bookingDateF(booking.event_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#8A7968;">🎉 Evento</td><td style="padding:6px 0;">${(booking.event_type || 'otro').replace(/</g, '&lt;')}</td></tr>
            ${booking.guests ? `<tr><td style="padding:6px 0;color:#8A7968;">👥 Invitados</td><td style="padding:6px 0;">${booking.guests}</td></tr>` : ''}
            ${booking.city  ? `<tr><td style="padding:6px 0;color:#8A7968;">📍 Ciudad</td><td style="padding:6px 0;">${booking.city.replace(/</g, '&lt;')}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#8A7968;">💸 Importe</td><td style="padding:6px 0;font-weight:bold;">${(booking.total_amount || 0).toLocaleString()}€</td></tr>
          </table>
          ${safeMsg ? `
          <div style="background:#FBF9F4;border-left:3px solid #E8553E;padding:14px 18px;margin:18px 0 0;font-size:14px;line-height:1.5;color:#5C534A;font-style:italic;">
            "${safeMsg.replace(/</g, '&lt;').replace(/\n/g, '<br>')}"
          </div>` : ''}
        </td></tr>

        <!-- Aviso datos ocultos -->
        <tr><td style="padding:0 36px;">
          <div style="background:#FFF7ED;border:1px solid #FFE1CC;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;line-height:1.55;">
            🔒 <strong>Datos del cliente protegidos.</strong> Nombre, email y teléfono se mostrarán cuando aceptes la reserva en tu panel. Esto protege a ambas partes y agiliza el cobro.
          </div>
        </td></tr>

        <tr><td style="padding:24px 36px 28px;">
          <div style="text-align:center;">
            <a href="https://fiestago.es/proveedor/panel" style="display:inline-block;background:#E8553E;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
              Aceptar o rechazar →
            </a>
          </div>
          <p style="margin:14px 0 0;font-size:12px;color:#8A7968;line-height:1.5;text-align:center;">
            Respondé en menos de 24h para una buena tasa de aceptación
          </p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · El marketplace de celebraciones · España
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: provider.email, subject, text, html })
}

// ════════════════════════════════════════════════════════════════
//  OUTREACH (email del agente de captación, con List-Unsubscribe + HTML completo)
// ════════════════════════════════════════════════════════════════

function splitSubjectAndBody(raw: string, fallbackSubject: string) {
  const m = raw.match(/^\s*ASUNTO:\s*(.+?)\s*\r?\n+/m)
  if (m) {
    const subject = m[1].trim()
    const body = raw.replace(/^\s*ASUNTO:.+\r?\n+/m, '')
    return { subject, body }
  }
  return { subject: fallbackSubject, body: raw }
}

function bodyToOutreachHtml(parsedBody: string): string {
  return parsedBody
    .split(/\r?\n\r?\n/)
    .map(para => {
      const lines = para.split(/\r?\n/)
      const allBullets = lines.length > 1 && lines.every(l => /^\s*[-•]\s+/.test(l))
      if (allBullets) {
        return `<ul style="margin:0 0 16px;padding:0;list-style:none;">` +
          lines.map(l => `<li style="padding:6px 0;font-size:14px;line-height:1.5;color:#1A1612;">
            <span style="color:#E8553E;font-weight:700;margin-right:8px;">✓</span>${
              l.replace(/^\s*[-•]\s+/, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            }</li>`).join('') +
          `</ul>`
      }
      const escaped = para
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>')
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#E8553E;text-decoration:none;font-weight:600;">$1</a>')
      return `<p style="margin:0 0 16px;line-height:1.65;font-size:15px;color:#5C534A;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">${escaped}</p>`
    }).join('')
}

/**
 * Envía el email outreach (captación) a un provider.
 * Aplica diseño HTML completo + List-Unsubscribe (RFC 8058) + sello calidad + banner lanzamiento.
 * Usado por ambos flujos: aprobación automática y "Enviar email" manual desde el admin.
 */
export async function emailProviderOutreach(
  provider: any,
  options?: { recipient?: string; bodyOverride?: string; subjectOverride?: string }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY no configurada' }

  const FROM_ADDRESS = process.env.OUTREACH_FROM      || 'contacto@fiestago.es'
  const FROM_NAME    = process.env.OUTREACH_FROM_NAME || 'FiestaGo'
  const REPLY_TO     = process.env.OUTREACH_REPLY_TO  || ''

  const recipient = options?.recipient || provider.email
  if (!recipient) return { ok: false, error: 'Proveedor sin email' }

  const draftRaw = options?.bodyOverride || provider.outreach_email || ''
  if (!draftRaw.trim()) return { ok: false, error: 'No hay borrador de email' }

  const fallbackSubject = options?.subjectOverride || `FiestaGo · ${provider.name}`
  const { subject: parsedSubject, body: parsedBody } = splitSubjectAndBody(draftRaw, fallbackSubject)
  const subject = options?.subjectOverride || parsedSubject

  const safeBody = bodyToOutreachHtml(parsedBody)

  const unsubscribeUrl    = `https://fiestago.es/unsubscribe?email=${encodeURIComponent(recipient)}&id=${provider.id || ''}`
  const unsubscribeMailto = `mailto:contacto@fiestago.es?subject=unsubscribe-${provider.id || ''}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1612;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:0;background:#1A1612;">
          <img src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80&auto=format&fit=crop" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;opacity:0.88;"/>
        </td></tr>
        <tr><td style="padding:24px 36px 0;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;letter-spacing:-0.01em;color:#1A1612;">FiestaGo<span style="color:#E8553E;">.</span></div>
          <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#E8553E;margin-top:8px;font-weight:700;">✨ Te queremos en nuestro marketplace</div>
        </td></tr>
        <tr><td style="padding:16px 36px 0;">
          <div style="background:#1A1612;color:#FBF7F0;border-radius:12px;padding:14px 18px;text-align:center;">
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;font-weight:700;margin-bottom:4px;">🚀 Lanzamiento oficial</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:500;line-height:1.2;">10 de junio de 2026</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:4px;line-height:1.4;">Estamos construyendo el catálogo. Los primeros profesionales tienen <strong style="color:#FBF7F0;">mejor posición</strong> en los resultados.</div>
          </div>
        </td></tr>
        <tr><td style="padding:28px 36px 8px;">${safeBody}</td></tr>
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FFEDE1 100%);border:1px solid #FFE1CC;border-radius:12px;padding:22px;">
            <div style="text-align:center;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;margin-bottom:16px;">Por qué te conviene FiestaGo</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${[
                ['🎁','Primera venta sin comisión','Cobras al 100% tu primera transacción.'],
                ['💸','Solo 8% después','La comisión más baja del sector. Sin cuotas mensuales.'],
                ['📅','Calendario inteligente','Marcas tus días libres y bloqueamos las fechas ya reservadas.'],
                ['🚀','Clientes cualificados','Solicitudes serias con fecha y datos completos.'],
                ['📣','Marketing gratis','Te promocionamos en Instagram y TikTok @fiestagospain.'],
                ['🛡','Sin permanencia','Pruébalo. Si no funciona, te das de baja en un click.'],
              ].map(([icon, title, desc]) => `<tr><td style="padding:8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td valign="top" width="34" style="font-size:20px;line-height:1;padding-right:12px;">${icon}</td><td valign="top"><div style="font-size:14px;font-weight:700;color:#1A1612;margin-bottom:2px;line-height:1.3;">${title}</div><div style="font-size:12.5px;color:#5C534A;line-height:1.5;">${desc}</div></td></tr></table></td></tr>`).join('')}
            </table>
          </div>
        </td></tr>
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FBF0E0 100%);border:2px solid #C8860A;border-radius:12px;padding:22px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;line-height:1;">🏆</div>
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C8860A;font-weight:700;margin-bottom:8px;">Sello de calidad · GRATIS</div>
            <div style="font-size:16px;font-weight:700;color:#1A1612;margin-bottom:6px;line-height:1.3;">Te lo regalamos al entrar</div>
            <div style="font-size:13px;color:#5C534A;line-height:1.55;max-width:420px;margin:0 auto;">Lo conservas mientras mantengas <strong>4,5/5</strong> en tus reseñas. Es un distintivo visible junto a tu perfil que aumenta la confianza de los clientes y las reservas.</div>
          </div>
        </td></tr>
        <tr><td style="padding:12px 36px 0;">
          <div style="background:linear-gradient(135deg,#FEF2EE 0%,#FCE3DC 100%);border:2px solid #E8553E;border-radius:12px;padding:22px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;line-height:1;">🤝</div>
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;font-weight:700;margin-bottom:8px;">Trae a un compañero · BONUS</div>
            <div style="font-size:16px;font-weight:700;color:#1A1612;margin-bottom:6px;line-height:1.3;">Subes a los primeros puestos</div>
            <div style="font-size:13px;color:#5C534A;line-height:1.55;max-width:420px;margin:0 auto;">Si invitas a otro profesional y se registra, los dos apareceréis en el <strong>top de vuestra categoría</strong> sin coste. Cuantos más traigas, más arriba.</div>
          </div>
        </td></tr>
        <tr><td style="padding:28px 36px 12px;text-align:center;">
          <a href="https://fiestago.es/registro-proveedor" style="display:inline-block;background:#E8553E;color:#FFFFFF;text-decoration:none;font-size:14px;letter-spacing:0.08em;font-weight:700;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(232,85,62,0.25);">Quiero darme de alta →</a>
          <div style="font-size:11px;color:#8A7968;margin-top:12px;">Gratis · Sin permanencia · 2 minutos</div>
        </td></tr>
        <tr><td style="padding:18px 36px 30px;text-align:center;">
          <p style="margin:0;font-size:12.5px;line-height:1.6;color:#5C534A;">¿Dudas? Escríbenos a <a href="mailto:contacto@fiestago.es" style="color:#E8553E;text-decoration:none;font-weight:600;">contacto@fiestago.es</a> o responde a este correo.</p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#1A1612;text-align:center;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">FiestaGo · El marketplace de celebraciones · España</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-top:10px;line-height:1.6;">Recibes este email porque tu negocio fue identificado como potencial socio.<br/><a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Darme de baja</a></div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:10px;"><a href="https://instagram.com/fiestagospain" style="color:rgba(255,255,255,0.55);text-decoration:none;">@fiestagospain</a> · <a href="https://fiestago.es" style="color:rgba(255,255,255,0.55);text-decoration:none;">fiestago.es</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:     `${FROM_NAME} <${FROM_ADDRESS}>`,
        to:       [recipient],
        subject,
        text:     parsedBody,
        html,
        reply_to: REPLY_TO || undefined,
        headers: {
          'List-Unsubscribe':      `<${unsubscribeMailto}>, <${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Entity-Ref-ID':       provider.id || '',
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as any)?.message || `HTTP ${res.status}` }
    return { ok: true, id: (data as any)?.id }
  } catch (err: any) {
    return { ok: false, error: err.message || 'fetch error' }
  }
}
