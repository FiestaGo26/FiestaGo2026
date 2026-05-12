import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAdminAuth(req: NextRequest) {
  const auth = req.headers.get('x-admin-password')
  return auth === process.env.ADMIN_PASSWORD
}

// Parsea ASUNTO: ... del cuerpo del draft, o devuelve por defecto.
function splitSubjectAndBody(raw: string, fallbackSubject: string) {
  const m = raw.match(/^\s*ASUNTO:\s*(.+?)\s*\r?\n+/m)
  if (m) {
    const subject = m[1].trim()
    const body = raw.replace(/^\s*ASUNTO:.+\r?\n+/m, '')
    return { subject, body }
  }
  return { subject: fallbackSubject, body: raw }
}

// POST /api/admin/send-outreach
//   body: { id: string, override?: { email?: string, subject?: string, body?: string } }
//   Lee el provider de Supabase, manda email via Resend y marca outreach_sent=true.
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const RESEND_KEY    = process.env.RESEND_API_KEY
  const FROM_ADDRESS  = process.env.OUTREACH_FROM     || 'contacto@fiestago.es'
  const FROM_NAME     = process.env.OUTREACH_FROM_NAME || 'FiestaGo'
  const REPLY_TO      = process.env.OUTREACH_REPLY_TO  || ''

  if (!RESEND_KEY) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY no configurada en Netlify' },
      { status: 500 }
    )
  }

  const body   = await req.json().catch(() => ({}))
  const id     = body.id
  const ovr    = body.override || {}

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: prov, error: fetchErr } = await supabase
    .from('providers')
    .select('id, name, email, outreach_email, outreach_sent')
    .eq('id', id)
    .single()

  if (fetchErr || !prov) {
    return NextResponse.json({ error: fetchErr?.message || 'Proveedor no encontrado' }, { status: 404 })
  }

  const recipient = ovr.email || prov.email
  if (!recipient) {
    return NextResponse.json({ error: 'El proveedor no tiene email' }, { status: 400 })
  }

  const draftRaw = ovr.body || prov.outreach_email || ''
  if (!draftRaw.trim()) {
    return NextResponse.json({ error: 'No hay borrador de email para este proveedor' }, { status: 400 })
  }

  const fallbackSubject = ovr.subject || `FiestaGo · ${prov.name}`
  const { subject: parsedSubject, body: parsedBody } = splitSubjectAndBody(draftRaw, fallbackSubject)
  const subject = ovr.subject || parsedSubject

  // Convertir saltos de línea del body a HTML escapado.
  // El cuerpo lo solemos generar con un patrón de "intro + lista guiones + CTA + firma":
  // - Líneas que empiezan con "- " se renderizan como bullet
  // - Líneas con "http..." se autolinkan
  const safeBody = parsedBody
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
      // párrafo normal con autolinks
      const escaped = para
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\r?\n/g, '<br>')
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#E8553E;text-decoration:none;font-weight:600;">$1</a>')
      return `<p style="margin:0 0 16px;line-height:1.65;font-size:15px;color:#5C534A;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${escaped}</p>`
    }).join('')

  // URL de baja (RFC 8058) — la usamos también en el footer del email
  const unsubscribeUrl = `https://fiestago.es/unsubscribe?email=${encodeURIComponent(recipient)}&id=${id}`
  const unsubscribeMailto = `mailto:contacto@fiestago.es?subject=unsubscribe-${id}`

  // Wrap del body en un template HTML elegante con cabecera, beneficios visuales y CTA.
  const safeName = (prov.name || '').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FBF7F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1612;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FBF7F0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #ECE3D2;">

        <!-- HERO foto -->
        <tr><td style="padding:0;background:#1A1612;">
          <img src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80&auto=format&fit=crop"
            alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;opacity:0.88;"/>
        </td></tr>

        <!-- Logo -->
        <tr><td style="padding:24px 36px 0;text-align:center;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;letter-spacing:-0.01em;color:#1A1612;">
            FiestaGo<span style="color:#E8553E;">.</span>
          </div>
          <div style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#E8553E;margin-top:8px;font-weight:700;">
            ✨ Te queremos en nuestro marketplace
          </div>
        </td></tr>

        <!-- Banner lanzamiento (importante para que no se asuste el proveedor) -->
        <tr><td style="padding:16px 36px 0;">
          <div style="background:#1A1612;color:#FBF7F0;border-radius:12px;padding:14px 18px;text-align:center;">
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;font-weight:700;margin-bottom:4px;">
              🚀 Lanzamiento oficial
            </div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:500;line-height:1.2;">
              10 de junio de 2026
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:4px;line-height:1.4;">
              Estamos construyendo el catálogo. Los primeros profesionales tienen <strong style="color:#FBF7F0;">mejor posición</strong> en los resultados.
            </div>
          </div>
        </td></tr>

        <!-- Cuerpo (procedente del draft, editable desde el admin) -->
        <tr><td style="padding:28px 36px 8px;">
          ${safeBody}
        </td></tr>

        <!-- Beneficios destacados (siempre se incluyen, no dependen del draft) -->
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FFEDE1 100%);border:1px solid #FFE1CC;border-radius:12px;padding:22px;">
            <div style="text-align:center;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#E8553E;margin-bottom:16px;">
              Por qué te conviene FiestaGo
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${[
                ['🎁','Primera venta sin comisión','Cobras al 100% tu primera transacción.'],
                ['💸','Solo 8% después','La comisión más baja del sector. Sin cuotas mensuales.'],
                ['📅','Calendario inteligente','Marcas tus días libres y bloqueamos las fechas ya reservadas.'],
                ['🚀','Clientes cualificados','Solicitudes serias con fecha y datos completos.'],
                ['📣','Marketing gratis','Te promocionamos en Instagram y TikTok @fiestagospain.'],
                ['🛡','Sin permanencia','Pruébalo. Si no funciona, te das de baja en un click.'],
              ].map(([icon, title, desc]) => `
                <tr><td style="padding:8px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td valign="top" width="34" style="font-size:20px;line-height:1;padding-right:12px;">${icon}</td>
                      <td valign="top">
                        <div style="font-size:14px;font-weight:700;color:#1A1612;margin-bottom:2px;line-height:1.3;">${title}</div>
                        <div style="font-size:12.5px;color:#5C534A;line-height:1.5;">${desc}</div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              `).join('')}
            </table>
          </div>
        </td></tr>

        <!-- SELLO DE CALIDAD (destacado ancho completo) -->
        <tr><td style="padding:8px 36px 0;">
          <div style="background:linear-gradient(135deg,#FFF7ED 0%,#FBF0E0 100%);border:2px solid #C8860A;border-radius:12px;padding:22px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;line-height:1;">🏆</div>
            <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#C8860A;font-weight:700;margin-bottom:8px;">
              Sello de calidad · GRATIS
            </div>
            <div style="font-size:16px;font-weight:700;color:#1A1612;margin-bottom:6px;line-height:1.3;">
              Te lo regalamos al entrar
            </div>
            <div style="font-size:13px;color:#5C534A;line-height:1.55;max-width:420px;margin:0 auto;">
              Lo conservas mientras mantengas <strong>4,5/5</strong> en tus reseñas. Es un distintivo visible junto a tu perfil que aumenta la confianza de los clientes y las reservas.
            </div>
          </div>
        </td></tr>

        <!-- CTA prominente -->
        <tr><td style="padding:28px 36px 12px;text-align:center;">
          <a href="https://fiestago.es/registro-proveedor" style="display:inline-block;background:#E8553E;color:#FFFFFF;text-decoration:none;font-size:14px;letter-spacing:0.08em;font-weight:700;padding:16px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(232,85,62,0.25);">
            Quiero darme de alta →
          </a>
          <div style="font-size:11px;color:#8A7968;margin-top:12px;">
            Gratis · Sin permanencia · 2 minutos
          </div>
        </td></tr>

        <!-- Soporte -->
        <tr><td style="padding:18px 36px 30px;text-align:center;">
          <p style="margin:0;font-size:12.5px;line-height:1.6;color:#5C534A;">
            ¿Dudas? Escríbenos a <a href="mailto:contacto@fiestago.es" style="color:#E8553E;text-decoration:none;font-weight:600;">contacto@fiestago.es</a> o responde a este correo.
          </p>
        </td></tr>

        <!-- Footer dark con baja -->
        <tr><td style="padding:18px 36px;background:#1A1612;text-align:center;">
          <div style="font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);">
            FiestaGo · El marketplace de celebraciones · España
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-top:10px;line-height:1.6;">
            Recibes este email porque tu negocio fue identificado como potencial socio.<br/>
            <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.7);text-decoration:underline;">Darme de baja</a>
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:10px;">
            <a href="https://instagram.com/fiestagospain" style="color:rgba(255,255,255,0.55);text-decoration:none;">@fiestagospain</a>
            ·
            <a href="https://fiestago.es" style="color:rgba(255,255,255,0.55);text-decoration:none;">fiestago.es</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`

  // Enviar via Resend REST API
  // Cabeceras requeridas por Microsoft / Gmail para email comercial:
  // List-Unsubscribe + List-Unsubscribe-Post (RFC 8058) = marketing legítimo
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    `${FROM_NAME} <${FROM_ADDRESS}>`,
      to:      [recipient],
      subject,
      text:    parsedBody,
      html,
      reply_to: REPLY_TO || undefined,
      headers: {
        'List-Unsubscribe':      `<${unsubscribeMailto}>, <${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID':       id,  // tracking estable
      },
    }),
  })

  const resendData = await resendRes.json().catch(() => ({}))

  if (!resendRes.ok) {
    return NextResponse.json(
      { error: resendData?.message || `Resend error ${resendRes.status}`, details: resendData },
      { status: 502 }
    )
  }

  // Marcar como enviado en Supabase
  const { error: updErr } = await supabase
    .from('providers')
    .update({
      outreach_sent: true,
      outreach_at:   new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) {
    // El email se mando pero no pudimos marcar el flag. Devolvemos 207 multi-status.
    return NextResponse.json(
      { sent: true, warning: 'Email enviado pero no se pudo actualizar outreach_sent: ' + updErr.message, resend_id: resendData?.id },
      { status: 207 }
    )
  }

  return NextResponse.json({
    sent: true,
    to:        recipient,
    from:      `${FROM_NAME} <${FROM_ADDRESS}>`,
    subject,
    resend_id: resendData?.id || null,
  })
}
