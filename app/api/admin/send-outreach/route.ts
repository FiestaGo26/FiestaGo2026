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

  // Convertir saltos de linea a HTML simple para mejorar la presentacion.
  const html = parsedBody
    .split(/\r?\n\r?\n/)
    .map(p => `<p style="margin:0 0 12px 0;line-height:1.55;font-family:Arial,Helvetica,sans-serif;">${
      p.replace(/\r?\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }</p>`)
    .join('')

  // Enviar via Resend REST API
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
