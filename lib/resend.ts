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

export async function sendEmail(opts: {
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
    ``,
    `═══ LO QUE YA TIENES DESBLOQUEADO HOY ═══`,
    ``,
    `Un pack de herramientas que si las pagases sueltas te costarían entre`,
    `265€ y 605€ AL MES. Tuyas gratis para siempre, aunque todavía no haya`,
    `llegado ninguna reserva.`,
    ``,
    `🧾 PRESUPUESTOS PROFESIONALES EN 10 SEGUNDOS`,
    `   Pega el mensaje del cliente y la IA te escribe el presupuesto completo`,
    `   con desglose, condiciones y total. Le pasas un link al cliente por`,
    `   WhatsApp y él lo ve bonito en su móvil.`,
    `   → Te ahorras 30-45 min por presupuesto (≈ 20-40€/mes en ChatGPT+Proposify)`,
    ``,
    `💬 PLANTILLAS WHATSAPP PARA RESPONDER EN 2 CLICS`,
    `   Nueve plantillas ya escritas para cada momento (consulta, presupuesto,`,
    `   confirmación, seguimiento, agradecimiento). Editas, rellenas datos del`,
    `   cliente y abres WhatsApp con el mensaje listo.`,
    `   → Te ahorras 5-10 min por cliente (≈ 15-30€/mes en apps tipo Respond.io)`,
    ``,
    `📍 POSTS PARA TU GOOGLE BUSINESS ESCRITOS POR IA`,
    `   Le dices un tema y la IA te escribe el post optimizado para aparecer`,
    `   más alto cuando alguien busque "[tu servicio] en ${provider.city || 'tu ciudad'}".`,
    `   → Te ahorras 20-30 min por post (≈ 150-400€/mes en community manager)`,
    ``,
    `Y además todo lo del marketplace en sí:`,
    `   🎁 Primera venta sin comisión — cobras al 100%.`,
    `   💸 Solo 8% después — sin cuotas, sin permanencia.`,
    `   📅 Calendario inteligente con sync a Google Calendar.`,
    `   🚀 Clientes cualificados con datos completos.`,
    `   🛡 Pago seguro y Garantía de Éxito incluida.`,
    `   🏆 Sello de calidad gratis si mantienes 4,5/5.`,
    `   📣 Marketing en IG y TikTok @fiestagospain.`,
    ``,
    `Ver todo lo que se incluye: https://fiestago.es/proveedor/valor`,
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

        <!-- Highlight del valor en herramientas (la joya nueva) -->
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#1A1612 0%,#2D2823 100%);color:#fff;border-radius:12px;padding:26px;text-align:center;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#FFB59A;margin-bottom:10px;">
              ✨ Tu pack de herramientas IA desbloqueado
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;color:#fff;margin-bottom:8px;line-height:1.15;">
              Valor equivalente: <span style="color:#E8553E;">265-605€/mes</span>
            </div>
            <div style="font-size:13px;color:#E5DDD3;line-height:1.55;max-width:440px;margin:0 auto;">
              Si pagases estas herramientas sueltas, te costarían eso al mes.
              Para ti, <strong style="color:#fff;">gratis y para siempre</strong>.
            </div>
            <a href="https://fiestago.es/proveedor/valor" style="display:inline-block;margin-top:14px;font-size:11px;color:#FFB59A;text-decoration:underline;letter-spacing:0.06em;">
              Ver desglose completo →
            </a>
          </div>
        </td></tr>

        <!-- Las 3 herramientas IA del panel -->
        <tr><td style="padding:18px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FFEDE1 100%);border:1px solid #FFE1CC;border-radius:12px;padding:24px;">
            <div style="text-align:center;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;margin-bottom:18px;">
              ⚡ Herramientas IA del panel
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${[
                ['🧾', 'Presupuestos IA en 10 segundos',         'Pega el mensaje del cliente y la IA te escribe el presupuesto completo, listo para mandar por WhatsApp con un link.<br/><strong style="color:#10B981;">↳ Ahorras 30-45 min/presupuesto · vale 20-40€/mes</strong>'],
                ['💬', 'Plantillas WhatsApp en 2 clics',         '9 plantillas ya escritas para cada momento del cliente (consulta, presupuesto, confirmación, seguimiento). Editables, con IA para crear nuevas.<br/><strong style="color:#10B981;">↳ Ahorras 5-10 min/cliente · vale 15-30€/mes</strong>'],
                ['📍', 'Posts Google Business escritos por IA',  'Le dices un tema y la IA te escribe el post optimizado para que aparezcas más alto en búsquedas locales en ' + safeCity + '.<br/><strong style="color:#10B981;">↳ Ahorras 20-30 min/post · vale 150-400€/mes</strong>'],
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

        <!-- Beneficios del marketplace en sí -->
        <tr><td style="padding:14px 36px 0;">
          <div style="background:#FFFFFF;border:1px solid #ECE3D2;border-radius:12px;padding:22px;">
            <div style="text-align:center;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#5C534A;margin-bottom:14px;">
              🌐 Y además, el marketplace
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${[
                ['🎁', 'Primera venta sin comisión',    'Tu primera transacción la cobras al 100%.'],
                ['💸', 'Solo 8% después',               'La comisión más baja del sector. Sin cuotas.'],
                ['📅', 'Calendario inteligente',        'Bloqueamos automáticamente las fechas reservadas.'],
                ['🚀', 'Clientes cualificados',         'Solo solicitudes serias, con fecha y datos completos.'],
                ['🛡', 'Pago seguro + Garantía Éxito',  'El cliente paga primero. Tú cobras tras el servicio.'],
                ['📣', 'Marketing gratis',              'Te promocionamos en IG y TikTok @fiestagospain.'],
              ].map(([icon, title, desc]) => `
                <tr><td style="padding:7px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td valign="top" width="32" style="font-size:18px;line-height:1;padding-right:10px;">${icon}</td>
                      <td valign="top">
                        <div style="font-size:13px;font-weight:700;color:#1A1612;line-height:1.3;display:inline;">${title}</div>
                        <span style="font-size:12px;color:#5C534A;line-height:1.5;"> — ${desc}</span>
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
              ['1', 'Entra al panel y prueba el <strong>🧾 Quote Generator IA</strong> con tu próximo cliente'],
              ['2', 'Personaliza las <strong>💬 plantillas de WhatsApp</strong> con tu tono'],
              ['3', 'Genera tu primer post de <strong>📍 Google Business</strong> con IA'],
              ['4', 'Completa tu perfil con fotos, servicios y disponibilidad'],
              ['5', '¡Recibe tus primeras reservas del marketplace! 🎊'],
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

// Email de confirmación a quien se apunta a la waitlist pre-lanzamiento.
// Confirma inscripción + comunica el beneficio (sorteo entre primeros 100
// + acceso prioritario el día del lanzamiento).
export async function emailWaitlistWelcome(entry: any) {
  if (!entry?.email) return { ok: false, error: 'Sin email' }
  const firstName = (entry.name || '').split(' ')[0] || 'hola'
  const subject = `🎉 Estás en la lista de FiestaGo — lanzamiento 10 de junio`
  const text = [
    `${firstName === 'hola' ? '¡Hola!' : `¡Hola ${firstName}!`}`,
    ``,
    `Te confirmo que estás en la waitlist de FiestaGo. Eres de los primeros y eso tiene premio.`,
    ``,
    `Qué pasa ahora:`,
    ``,
    `🔓 Acceso prioritario el 10 de junio — entras antes de que abramos al público y reservas las mejores fechas del verano.`,
    ``,
    `🎁 Sorteo entre los primeros 100 inscritos — un evento completo de hasta 300€ para uno de vosotros (fotógrafo, decoración, animación… lo que elijas del catálogo).`,
    ``,
    `🛡️ Garantía de Éxito incluida en todas tus reservas — si tu proveedor falla, te respondemos económicamente. Esto no lo encontrarás en Bodas.net ni Zankyou.`,
    ``,
    `Mientras tanto, ya puedes ojear el catálogo y guardar tus favoritos:`,
    `https://fiestago.es/proveedores`,
    ``,
    `Si tienes una fecha en mente o quieres avisar a tu pareja, comparte tu shortlist con un solo link desde la sección de favoritos.`,
    ``,
    `Cualquier duda, responde a este correo. Estamos al otro lado.`,
    ``,
    `Un abrazo,`,
    `Mariano — Fundador de FiestaGo`,
  ].join('\n')
  return sendEmail({ to: entry.email, subject, text })
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
Cobrarías: ${(booking.provider_earns || 0).toLocaleString()}€  (cliente pagó ${(booking.total_amount || 0).toLocaleString()}€, incluye nuestra comisión)

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
            <tr><td style="padding:6px 0;color:#8A7968;">💸 Cobrarías</td><td style="padding:6px 0;font-weight:bold;color:#10B981;">${(booking.provider_earns || 0).toLocaleString()}€</td></tr>
            <tr><td style="padding:2px 0;color:#8A7968;font-size:12px;">Cliente pagó</td><td style="padding:2px 0;font-size:12px;color:#8A7968;">${(booking.total_amount || 0).toLocaleString()}€ (con nuestra comisión)</td></tr>
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

// Confirma al cliente que su solicitud llegó y le entrega la auto-respuesta
// del proveedor (si la tiene configurada). Es el primer email que recibe
// el cliente nada más reservar.
export async function emailClientBookingReceived(booking: any, provider: any) {
  if (!booking?.client_email) return { ok: false, error: 'Cliente sin email' }

  const replyMsg = (provider?.auto_reply_message || '').trim()
  const subject  = `✓ Solicitud enviada a ${provider?.name || 'tu proveedor'}`

  const text = `Hola ${(booking.client_name || '').split(' ')[0] || ''},

Hemos enviado tu solicitud de reserva a ${provider?.name || 'el proveedor'} para el ${bookingDateF(booking.event_date)}.

${replyMsg ? `Mensaje del proveedor:\n"${replyMsg}"\n\n` : ''}El proveedor confirmará tu reserva en su panel. Cuando lo haga te lo notificaremos por email y podrás chatear con él desde tu cuenta.

Tu reserva:
- Fecha:    ${bookingDateF(booking.event_date)}
- Evento:   ${booking.event_type || 'otro'}
- Importe:  ${(booking.total_amount || 0).toLocaleString()}€

Ver el estado en tu cuenta: https://fiestago.es/mi-cuenta

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const replyBlock = replyMsg ? `
        <tr><td style="padding:8px 36px 0;">
          <div style="background:#FFF7ED;border:1px solid #FFE1CC;border-radius:10px;padding:16px 18px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#E8553E;margin-bottom:8px;">💬 Mensaje de ${safe(provider?.name || 'tu proveedor')}</div>
            <div style="font-size:14px;color:#1A1612;line-height:1.55;white-space:pre-wrap;">${safe(replyMsg)}</div>
          </div>
        </td></tr>` : ''

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#10B981;margin-bottom:14px;">✓ Solicitud enviada</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;color:#1A1612;line-height:1.2;">
            Hola ${safe((booking.client_name || '').split(' ')[0] || '')}, tu solicitud está en marcha.
          </h1>
          <p style="margin:0;font-size:15px;color:#5C534A;line-height:1.55;">
            Hemos avisado a <strong>${safe(provider?.name || 'tu proveedor')}</strong> de tu reserva para el <strong style="color:#E8553E;">${bookingDateF(booking.event_date)}</strong>.
          </p>
        </td></tr>
        ${replyBlock}
        <tr><td style="padding:20px 36px 8px;">
          <table width="100%" style="font-size:14px;color:#1A1612;">
            <tr><td style="padding:6px 0;color:#8A7968;width:120px;">📅 Fecha</td><td style="padding:6px 0;font-weight:bold;color:#E8553E;">${bookingDateF(booking.event_date)}</td></tr>
            <tr><td style="padding:6px 0;color:#8A7968;">🎉 Evento</td><td style="padding:6px 0;">${safe(booking.event_type || 'otro')}</td></tr>
            <tr><td style="padding:6px 0;color:#8A7968;">💸 Importe</td><td style="padding:6px 0;font-weight:bold;">${(booking.total_amount || 0).toLocaleString()}€</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:14px 36px 28px;">
          <div style="text-align:center;">
            <a href="https://fiestago.es/mi-cuenta" style="display:inline-block;background:#1A1612;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;">
              Ver mi reserva →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · El marketplace de celebraciones · España
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: booking.client_email, subject, text, html })
}

// El proveedor ha aceptado la reserva. Se libera el contacto del proveedor
// (email/teléfono que el cliente ya puede usar) y se confirma la fecha.
export async function emailClientBookingConfirmed(booking: any, provider: any) {
  if (!booking?.client_email) return { ok: false, error: 'Cliente sin email' }

  const subject = `✅ Reserva confirmada · ${provider?.name || 'Tu proveedor'} · ${bookingDateF(booking.event_date)}`
  const firstName = (booking.client_name || '').split(' ')[0] || ''

  const text = `Hola ${firstName},

¡Buenas noticias! ${provider?.name || 'El proveedor'} ha confirmado tu reserva para el ${bookingDateF(booking.event_date)}.

Datos de contacto del proveedor (ya puedes escribirle por chat o llamarle):
- Email:    ${provider?.email || '—'}
- Teléfono: ${provider?.phone || '—'}

Tu reserva:
- Fecha:    ${bookingDateF(booking.event_date)}
- Evento:   ${booking.event_type || 'otro'}
- Importe:  ${(booking.total_amount || 0).toLocaleString()}€

Puedes seguir hablando con el proveedor a través del chat de FiestaGo:
https://fiestago.es/mi-cuenta

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#10B981;margin-bottom:14px;">✓ Reserva confirmada</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:26px;color:#1A1612;line-height:1.2;">
            ¡${safe(firstName)}, ${safe(provider?.name || 'tu proveedor')} acepta tu reserva!
          </h1>
          <p style="margin:0;font-size:15px;color:#5C534A;line-height:1.55;">
            Te están esperando el <strong style="color:#E8553E;">${bookingDateF(booking.event_date)}</strong>.
          </p>
        </td></tr>
        <tr><td style="padding:20px 36px 8px;">
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#10B981;margin-bottom:8px;">Contacto del proveedor</div>
            <table width="100%" style="font-size:14px;color:#1A1612;">
              ${provider?.email ? `<tr><td style="padding:4px 0;color:#5C534A;width:90px;">📧 Email</td><td style="padding:4px 0;"><a href="mailto:${safe(provider.email)}" style="color:#10B981;text-decoration:none;">${safe(provider.email)}</a></td></tr>` : ''}
              ${provider?.phone ? `<tr><td style="padding:4px 0;color:#5C534A;">📞 Teléfono</td><td style="padding:4px 0;"><a href="tel:${safe(provider.phone)}" style="color:#10B981;text-decoration:none;">${safe(provider.phone)}</a></td></tr>` : ''}
            </table>
          </div>
        </td></tr>
        <tr><td style="padding:14px 36px 28px;">
          <div style="text-align:center;">
            <a href="https://fiestago.es/mi-cuenta" style="display:inline-block;background:#E8553E;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
              💬 Abrir chat con el proveedor →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · El marketplace de celebraciones · España
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: booking.client_email, subject, text, html })
}

// La reserva se ha cancelado (por el proveedor, el admin o el propio cliente).
// `cancelledBy` indica quién la canceló para mostrar mensaje adecuado.
export async function emailClientBookingCancelled(
  booking: any,
  provider: any,
  cancelledBy: 'provider' | 'admin' | 'client' = 'provider',
  reason?: string,
  refund?: { percent: number; amount: number; rule: string } | null,
) {
  if (!booking?.client_email) return { ok: false, error: 'Cliente sin email' }

  const firstName = (booking.client_name || '').split(' ')[0] || ''
  const who =
    cancelledBy === 'provider' ? (provider?.name || 'El proveedor') :
    cancelledBy === 'admin'    ? 'El equipo de FiestaGo' : 'Tú'

  const subject = `Reserva cancelada · ${bookingDateF(booking.event_date)}`

  const refundLine = refund
    ? (refund.amount > 0
        ? `Reembolso aplicable: ${refund.amount.toLocaleString()}€ (${refund.percent}%) — ${refund.rule}.\nLo procesaremos en los próximos 5 días hábiles.\n\n`
        : `Reembolso aplicable: 0€ (${refund.rule}).\n\n`)
    : 'Si has pagado un anticipo, te contactaremos en las próximas 48h para gestionar el reembolso según la política de cancelación del servicio.\n\n'

  const text = `Hola ${firstName},

${who} ha cancelado la reserva del ${bookingDateF(booking.event_date)} con ${provider?.name || 'el proveedor'}.

${reason ? `Motivo: ${reason}\n\n` : ''}${refundLine}Buscar otro proveedor: https://fiestago.es/servicios

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:36px 36px 24px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#EF4444;margin-bottom:14px;">Reserva cancelada</div>
          <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;color:#1A1612;line-height:1.25;">
            Hola ${safe(firstName)}, ${cancelledBy === 'client' ? 'has cancelado' : safe(who) + ' ha cancelado'} la reserva del ${bookingDateF(booking.event_date)}.
          </h1>
          ${reason ? `<p style="margin:12px 0 0;font-size:14px;color:#5C534A;line-height:1.55;font-style:italic;">Motivo: ${safe(reason)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:20px 36px 8px;">
          <div style="background:#FEF3F2;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;line-height:1.55;">
            ${refund
              ? (refund.amount > 0
                  ? `💸 <strong>Reembolso aplicable: ${refund.amount.toLocaleString()}€</strong> (${refund.percent}%, según política <em>${safe(refund.rule)}</em>). Se procesará en los próximos 5 días hábiles.`
                  : `💸 <strong>Reembolso aplicable: 0€</strong> según política <em>${safe(refund.rule)}</em>.`)
              : `💸 <strong>Reembolso.</strong> Si pagaste un anticipo, te contactaremos en las próximas 48h para procesarlo según la política de cancelación del servicio.`}
          </div>
        </td></tr>
        <tr><td style="padding:14px 36px 28px;">
          <div style="text-align:center;">
            <a href="https://fiestago.es/servicios" style="display:inline-block;background:#1A1612;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;">
              Buscar otro proveedor →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · El marketplace de celebraciones · España
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: booking.client_email, subject, text, html })
}

// Aviso de mensaje nuevo en el chat de una reserva. Solo se envía cuando
// no hay otros mensajes sin leer del mismo emisor (para no spamear durante
// una conversación activa).
export async function emailChatMessage(opts: {
  to: string
  recipientName: string
  senderName: string
  body: string
  bookingDate: string
  recipientRole: 'client' | 'provider'
}) {
  const { to, recipientName, senderName, body, bookingDate, recipientRole } = opts
  if (!to) return { ok: false, error: 'Sin email destinatario' }

  const ctaUrl = recipientRole === 'provider'
    ? 'https://fiestago.es/proveedor/panel'
    : 'https://fiestago.es/mi-cuenta'

  const firstName = (recipientName || '').split(' ')[0] || ''
  const subject = `💬 ${senderName}: "${body.slice(0, 60)}${body.length > 60 ? '…' : ''}"`

  const text = `Hola ${firstName},

${senderName} te ha escrito sobre la reserva del ${bookingDate}:

"${body}"

Responde desde tu panel: ${ctaUrl}

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 18px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#E8553E;margin-bottom:12px;">💬 Nuevo mensaje</div>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:22px;color:#1A1612;line-height:1.3;">
            ${safe(senderName)} te ha escrito
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Sobre la reserva del ${bookingDate}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;">
          <div style="background:#FBF9F4;border-left:3px solid #E8553E;padding:14px 18px;border-radius:0 8px 8px 0;font-size:14px;color:#1A1612;line-height:1.6;white-space:pre-wrap;">${safe(body)}</div>
        </td></tr>
        <tr><td style="padding:8px 36px 26px;">
          <div style="text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background:#E8553E;color:#fff;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:14px;">
              Responder en FiestaGo →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:14px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:11px;color:#8A7968;">
          Recibes este aviso porque hay un mensaje sin leer en tu chat de FiestaGo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to, subject, text, html })
}

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

// ════════════════════════════════════════════════════════════════
//  INCIDENCIAS — resolución / rechazo
// ════════════════════════════════════════════════════════════════

// El admin ha resuelto la incidencia. Le contamos al cliente qué se hizo
// y el importe de compensación si aplica.
// Aviso al proveedor de que se ha abierto una incidencia contra una de
// sus reservas. Le decimos tipo, descripción del cliente y CTA al panel.
// Es importante que no suene a "estás culpable", sino a "ha pasado X,
// danos tu versión si crees que hace falta".
// Confirmación al proveedor de que se le ha cobrado un cargo de
// incidencia (descontado del payout o facturado directamente). Sirve
// como recibo formal de la operación.
export async function emailProviderChargeCollected(opts: {
  providerEmail: string
  providerName:  string
  clientName:    string
  eventDate:     string
  amount:        number
  resolution?:   string
}) {
  const { providerEmail, providerName, clientName, eventDate, amount, resolution } = opts
  if (!providerEmail) return { ok: false, error: 'Sin email del proveedor' }

  const subject = `Cargo aplicado · ${amount.toLocaleString('es-ES')}€ · reserva del ${bookingDateF(eventDate)}`

  const text = `Hola ${providerName},

Te confirmamos que hemos aplicado el cargo derivado de la incidencia sobre la reserva con ${clientName} del ${bookingDateF(eventDate)}.

Importe cobrado: ${amount.toLocaleString('es-ES')}€
${resolution ? `\nResolución de la incidencia:\n${resolution}\n` : ''}
Este importe se ha descontado de tu próximo payout (o facturado directamente si no había payouts suficientes).

Si tienes cualquier duda sobre el cargo, responde a este email.

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#6B7280;margin-bottom:12px;">Recibo de cargo</div>
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:22px;color:#1A1612;line-height:1.3;">
            Hola ${safe(providerName)}, cargo aplicado.
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Reserva de ${safe(clientName)} · ${bookingDateF(eventDate)}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;">
          <div style="background:#FBF9F4;border:1px solid #ECE3D2;border-radius:10px;padding:18px 20px;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:6px;">Importe cobrado</div>
            <div style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#1A1612;">${amount.toLocaleString('es-ES')}€</div>
            <div style="font-size:12px;color:#8A7968;margin-top:6px;">Descontado del próximo payout o facturado directamente.</div>
          </div>
        </td></tr>
        ${resolution ? `
        <tr><td style="padding:6px 36px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:6px;">Resolución de la incidencia</div>
          <div style="font-size:13px;color:#5C534A;line-height:1.55;white-space:pre-wrap;">${safe(resolution)}</div>
        </td></tr>` : ''}
        <tr><td style="padding:18px 36px 28px;">
          <p style="margin:0;font-size:13px;color:#5C534A;line-height:1.55;">
            Si tienes cualquier duda sobre el cargo, responde a este email y te contestamos en menos de 24h.
          </p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · contacto@fiestago.es
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: providerEmail, subject, text, html })
}

export async function emailProviderIncidentOpened(opts: {
  providerEmail: string
  providerName:  string
  clientName:    string
  eventDate:     string
  type:          string
  description:   string
  estimatedCharge?: { clientReceives: number; providerCharge: number } | null
}) {
  const { providerEmail, providerName, clientName, eventDate, type, description, estimatedCharge } = opts
  if (!providerEmail) return { ok: false, error: 'Sin email del proveedor' }

  const typeLabel: Record<string,string> = {
    cancelled_by_provider: 'cancelación atribuida al proveedor',
    no_show:               'no-show',
    quality:               'queja por calidad del servicio',
    wrong_service:         'servicio distinto al reservado',
    payment:               'problema con el pago',
    other:                 'otro problema',
  }
  const subject = `🚨 Incidencia abierta — reserva del ${bookingDateF(eventDate)}`

  const chargeBlockText = estimatedCharge
    ? `\n⚠ Cargo estimado si la incidencia se confirma:
   - Cliente recibirá: ${estimatedCharge.clientReceives.toLocaleString('es-ES')}€
   - Se te cobrará a ti: ${estimatedCharge.providerCharge.toLocaleString('es-ES')}€
   (se descontará del próximo payout o se facturará directamente)
`
    : ''

  const text = `Hola ${providerName},

${clientName} ha abierto una incidencia sobre la reserva del ${bookingDateF(eventDate)}.

Motivo reportado: ${typeLabel[type] || type}

Lo que cuenta el cliente:
"${description}"
${chargeBlockText}
Estamos revisando el caso desde el equipo de FiestaGo. Mientras lo investigamos, el pago de esa reserva queda en suspenso. Si quieres darnos tu versión o aportar pruebas (chats, fotos, etc.), responde a este email cuanto antes — es lo que más ayuda a resolverlo rápido y de forma justa.

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const chargeBlockHtml = estimatedCharge ? `
        <tr><td style="padding:0 36px 14px;">
          <div style="background:#FEF3F2;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;line-height:1.6;">
            <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#EF4444;margin-bottom:8px;">⚠ Cargo estimado si se confirma</div>
            <table width="100%" style="font-size:13px;color:#1A1612;">
              <tr><td style="padding:4px 0;color:#5C534A;width:60%;">El cliente recibirá</td><td style="padding:4px 0;font-weight:bold;text-align:right;">${estimatedCharge.clientReceives.toLocaleString('es-ES')}€</td></tr>
              <tr><td style="padding:4px 0;color:#5C534A;">Se te cobrará a ti</td><td style="padding:4px 0;font-weight:bold;text-align:right;color:#EF4444;">${estimatedCharge.providerCharge.toLocaleString('es-ES')}€</td></tr>
            </table>
            <div style="font-size:11px;color:#8A7968;margin-top:8px;">Se descontará del próximo payout o se facturará directamente. Tu testimonio puede cambiar esta cifra.</div>
          </div>
        </td></tr>` : ''

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#F59E0B;margin-bottom:12px;">🚨 Incidencia abierta</div>
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:22px;color:#1A1612;line-height:1.3;">
            Hola ${safe(providerName)}, hemos recibido una incidencia.
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Reserva de ${safe(clientName)} · ${bookingDateF(eventDate)}</p>
        </td></tr>
        <tr><td style="padding:18px 36px 4px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:4px;">Motivo</div>
          <div style="font-size:14px;font-weight:bold;color:#1A1612;">${safe(typeLabel[type] || type)}</div>
        </td></tr>
        <tr><td style="padding:14px 36px 4px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:6px;">Lo que cuenta el cliente</div>
          <div style="background:#FBF9F4;border-left:3px solid #E8553E;padding:12px 16px;font-size:14px;color:#1A1612;line-height:1.55;white-space:pre-wrap;font-style:italic;">${safe(description)}</div>
        </td></tr>
        ${chargeBlockHtml}
        <tr><td style="padding:18px 36px;">
          <div style="background:#FFF7ED;border:1px solid #FFE1CC;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;line-height:1.55;">
            ⏸ <strong>Pago suspendido temporalmente</strong> mientras el equipo investiga. La suspensión se levanta automáticamente al cerrar la incidencia.
          </div>
        </td></tr>
        <tr><td style="padding:6px 36px 28px;">
          <p style="margin:0 0 14px;font-size:13px;color:#5C534A;line-height:1.55;">
            Si quieres darnos tu versión o aportar pruebas (chats, fotos, recibos…), <strong>responde a este email cuanto antes</strong>. Tu testimonio es lo que más ayuda a resolverlo rápido y de forma justa.
          </p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · contacto@fiestago.es
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: providerEmail, subject, text, html })
}

// Aviso al proveedor del resultado de la incidencia. Si fue resuelta con
// compensación que sale parcialmente de su bolsillo (descuento al payout),
// se lo decimos claro.
export async function emailProviderIncidentClosed(opts: {
  providerEmail: string
  providerName:  string
  clientName:    string
  eventDate:     string
  status:        'resolved' | 'rejected'
  resolution?:   string
  rejectedReason?: string
  compensationAmount?: number | null
}) {
  const { providerEmail, providerName, clientName, eventDate, status, resolution, rejectedReason, compensationAmount } = opts
  if (!providerEmail) return { ok: false, error: 'Sin email del proveedor' }

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const isResolved = status === 'resolved'
  const subject   = isResolved
    ? `Incidencia cerrada — reserva del ${bookingDateF(eventDate)}`
    : `Incidencia desestimada — reserva del ${bookingDateF(eventDate)}`

  const compNote = isResolved && compensationAmount && compensationAmount > 0
    ? `\n\nCompensación al cliente: ${compensationAmount.toLocaleString('es-ES')}€. Parte de este importe puede descontarse de tu próximo payout — te avisaremos por separado del desglose exacto.`
    : ''

  const text = isResolved
    ? `Hola ${providerName},

Hemos cerrado la incidencia que ${clientName} abrió sobre la reserva del ${bookingDateF(eventDate)}.

Resolución:
${resolution || ''}${compNote}

Si tienes cualquier duda, responde a este email.

Un saludo,
El equipo de FiestaGo`
    : `Hola ${providerName},

Hemos revisado la incidencia que ${clientName} abrió sobre la reserva del ${bookingDateF(eventDate)} y la hemos desestimado. La suspensión del pago queda levantada.

Motivo de la desestimación:
${rejectedReason || ''}

Gracias por tu trabajo. Un saludo,
El equipo de FiestaGo`

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:${isResolved ? '#10B981' : '#8A7968'};margin-bottom:12px;">
            ${isResolved ? '✓ Incidencia cerrada' : '✓ Incidencia desestimada'}
          </div>
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:22px;color:#1A1612;line-height:1.3;">
            Hola ${safe(providerName)},${isResolved ? ' caso resuelto.' : ' tu trabajo queda confirmado.'}
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Reserva de ${safe(clientName)} · ${bookingDateF(eventDate)}</p>
        </td></tr>
        <tr><td style="padding:18px 36px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:6px;">
            ${isResolved ? 'Resolución' : 'Motivo de la desestimación'}
          </div>
          <div style="background:#FBF9F4;border-left:3px solid ${isResolved ? '#10B981' : '#8A7968'};padding:12px 16px;font-size:14px;color:#1A1612;line-height:1.55;white-space:pre-wrap;">${safe(isResolved ? (resolution || '') : (rejectedReason || ''))}</div>
        </td></tr>
        ${isResolved && compensationAmount && compensationAmount > 0 ? `
        <tr><td style="padding:0 36px 14px;">
          <div style="background:#FEF3F2;border:1px solid #FECACA;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;line-height:1.55;">
            💸 <strong>Compensación al cliente: ${compensationAmount.toLocaleString('es-ES')}€.</strong>
            <div style="margin-top:4px;">Parte de este importe puede descontarse de tu próximo payout. Te enviaremos el desglose exacto por separado.</div>
          </div>
        </td></tr>` : ''}
        ${!isResolved ? `
        <tr><td style="padding:0 36px 14px;">
          <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;">
            ✓ <strong>La suspensión del pago queda levantada.</strong> Tu próximo payout se procesa con normalidad.
          </div>
        </td></tr>` : ''}
        <tr><td style="padding:0 36px 28px;">
          <p style="margin:0;font-size:13px;color:#5C534A;line-height:1.55;">
            Si tienes cualquier duda sobre esta resolución, responde a este email.
          </p>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · contacto@fiestago.es
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: providerEmail, subject, text, html })
}

export async function emailClientIncidentResolved(opts: {
  clientEmail:   string
  clientName:    string
  providerName:  string
  eventDate:     string
  resolution:    string
  compensationAmount?: number | null
}) {
  const { clientEmail, clientName, providerName, eventDate, resolution, compensationAmount } = opts
  if (!clientEmail) return { ok: false, error: 'Sin email del cliente' }

  const firstName = (clientName || '').split(' ')[0] || ''
  const subject   = `✓ Incidencia resuelta — reserva del ${bookingDateF(eventDate)}`
  const compLine  = compensationAmount && compensationAmount > 0
    ? `Compensación: ${compensationAmount.toLocaleString('es-ES')}€. Te lo transferimos al método de pago original en 5 días hábiles.`
    : 'No procede compensación económica en este caso, pero se ha gestionado.'

  const text = `Hola ${firstName},

Hemos resuelto la incidencia que abriste sobre tu reserva con ${providerName} del ${bookingDateF(eventDate)}.

Qué hemos hecho:
${resolution}

${compLine}

Si tienes alguna duda sobre la resolución, responde a este email y te respondemos en menos de 24h.

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#10B981;margin-bottom:12px;">✓ Incidencia resuelta</div>
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:24px;color:#1A1612;line-height:1.25;">
            ${safe(firstName)}, ya lo tenemos arreglado.
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Reserva con ${safe(providerName)} · ${bookingDateF(eventDate)}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;">
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.18em;text-transform:uppercase;color:#8A7968;margin-bottom:6px;">Qué hemos hecho</div>
          <div style="font-size:14px;color:#1A1612;line-height:1.6;white-space:pre-wrap;">${safe(resolution)}</div>
        </td></tr>
        ${compensationAmount && compensationAmount > 0 ? `
        <tr><td style="padding:0 36px 8px;">
          <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:14px 16px;font-size:14px;color:#1A1612;">
            💸 <strong>Compensación: ${compensationAmount.toLocaleString('es-ES')}€</strong>
            <div style="font-size:12px;color:#5C534A;margin-top:4px;">Te lo transferimos al método de pago original en 5 días hábiles.</div>
          </div>
        </td></tr>` : `
        <tr><td style="padding:0 36px 8px;">
          <div style="background:#FBF9F4;border:1px solid #ECE3D2;border-radius:10px;padding:14px 16px;font-size:13px;color:#5C534A;">
            No procede compensación económica en este caso, pero la incidencia se ha gestionado.
          </div>
        </td></tr>`}
        <tr><td style="padding:14px 36px 28px;">
          <p style="margin:0;font-size:13px;color:#5C534A;line-height:1.55;">
            Si tienes alguna duda sobre la resolución, responde a este email y te contestamos en menos de 24h.
          </p>
          <div style="margin-top:18px;text-align:center;">
            <a href="https://fiestago.es/mi-cuenta" style="display:inline-block;background:#1A1612;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;">
              Ver mi cuenta →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · Garantía de Éxito · contacto@fiestago.es
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: clientEmail, subject, text, html })
}

// La incidencia se ha rechazado (no procede según los términos de la
// Garantía). Le explicamos al cliente el motivo y abrimos la puerta a
// reabrirlo con más info.
export async function emailClientIncidentRejected(opts: {
  clientEmail:    string
  clientName:     string
  providerName:   string
  eventDate:      string
  rejectedReason: string
}) {
  const { clientEmail, clientName, providerName, eventDate, rejectedReason } = opts
  if (!clientEmail) return { ok: false, error: 'Sin email del cliente' }

  const firstName = (clientName || '').split(' ')[0] || ''
  const subject   = `Sobre tu incidencia — reserva del ${bookingDateF(eventDate)}`

  const text = `Hola ${firstName},

Hemos revisado la incidencia que abriste sobre tu reserva con ${providerName} del ${bookingDateF(eventDate)}.

Tras analizarla, no podemos cubrirla con la Garantía de Éxito por el siguiente motivo:

${rejectedReason}

Si no estás de acuerdo con esta decisión o crees que faltó información importante, responde a este email con los detalles adicionales y reabriremos el caso.

También puedes leer en detalle qué cubre la garantía aquí:
https://fiestago.es/garantia

Un saludo,
El equipo de FiestaGo`

  const safe = (s: string) => (s || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#FBF7F0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECE3D2;">
        <tr><td style="padding:32px 36px 20px;border-bottom:1px solid #ECE3D2;">
          <div style="font-size:11px;font-weight:bold;letter-spacing:0.2em;text-transform:uppercase;color:#8A7968;margin-bottom:12px;">Sobre tu incidencia</div>
          <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-size:24px;color:#1A1612;line-height:1.25;">
            Hola ${safe(firstName)}, hemos revisado tu caso.
          </h1>
          <p style="margin:6px 0 0;font-size:13px;color:#8A7968;">Reserva con ${safe(providerName)} · ${bookingDateF(eventDate)}</p>
        </td></tr>
        <tr><td style="padding:20px 36px;">
          <p style="margin:0 0 12px;font-size:14px;color:#1A1612;line-height:1.6;">
            Tras analizarla, no podemos cubrirla con la Garantía de Éxito por el siguiente motivo:
          </p>
          <div style="background:#FEF3F2;border-left:3px solid #EF4444;padding:12px 16px;font-size:14px;color:#1A1612;line-height:1.55;white-space:pre-wrap;">${safe(rejectedReason)}</div>
        </td></tr>
        <tr><td style="padding:14px 36px 28px;">
          <p style="margin:0 0 14px;font-size:13px;color:#5C534A;line-height:1.55;">
            Si no estás de acuerdo con esta decisión o crees que faltó información importante, responde a este email con los detalles adicionales y reabriremos el caso.
          </p>
          <div style="text-align:center;">
            <a href="https://fiestago.es/garantia" style="display:inline-block;background:#1A1612;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;">
              Qué cubre la Garantía →
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 36px;background:#FBF9F4;border-top:1px solid #ECE3D2;text-align:center;font-size:12px;color:#8A7968;">
          FiestaGo · contacto@fiestago.es
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return sendEmail({ to: clientEmail, subject, text, html })
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
