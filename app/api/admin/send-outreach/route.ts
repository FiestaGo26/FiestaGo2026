import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailProviderOutreach } from '@/lib/resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  const auth = req.headers.get('x-admin-password')
  return auth === process.env.ADMIN_PASSWORD
}

// POST /api/admin/send-outreach
//   body: { id: string, override?: { email?: string, subject?: string, body?: string } }
//   Envia el email outreach con diseño completo (HTML + sello + List-Unsubscribe)
//   y marca outreach_sent=true. Misma función que la aprobación automática.
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id   = body.id
  const ovr  = body.override || {}

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

  // Envía con la función compartida (mismo diseño que aprobación automática)
  const result = await emailProviderOutreach(prov, {
    recipient:       ovr.email,
    subjectOverride: ovr.subject,
    bodyOverride:    ovr.body,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Error al enviar' }, { status: 502 })
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
    return NextResponse.json(
      { sent: true, warning: 'Email enviado pero no se pudo actualizar outreach_sent: ' + updErr.message, resend_id: result.id },
      { status: 207 }
    )
  }

  return NextResponse.json({
    sent:      true,
    to:        ovr.email || prov.email,
    resend_id: result.id || null,
  })
}
