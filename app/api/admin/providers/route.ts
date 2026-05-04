import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

async function sendOutreachEmail(provider: any) {
  if (!provider.outreach_email || !provider.email) return false
  if (!process.env.RESEND_API_KEY) {
    console.log('[OUTREACH] RESEND_API_KEY no configurada')
    return false
  }

  const lines   = provider.outreach_email.split('\n')
  const subjL   = lines.find((l: string) => l.startsWith('ASUNTO:'))
  const subject = subjL ? subjL.replace('ASUNTO:', '').trim() : `Únete a FiestaGo — ${provider.name}`
  const bodyText = lines.filter((l: string) => !l.startsWith('ASUNTO:')).join('\n').trim()

  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://fiestago.es'}/registro-proveedor`
  const contactEmail = 'contacto@fiestago.es'

  const fullText = `${bodyText}

Regístrate gratis aquí: ${registerUrl}

¿Tienes dudas? Escríbenos a ${contactEmail}

FiestaGo Partnerships | ${contactEmail}`

  const htmlBody = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1C1108">
  <div style="margin-bottom:24px">
    <span style="font-size:28px">🎉</span>
    <strong style="font-size:20px;color:#1C1108"> FiestaGo</strong>
  </div>

  ${bodyText.split('\n').filter(Boolean).map((line: string) =>
    `<p style="color:#4A4A4A;line-height:1.7;margin:0 0 14px">${line}</p>`
  ).join('')}

  <div style="margin:32px 0;text-align:center">
    <a href="${registerUrl}"
      style="background:#E8553E;color:#fff;text-decoration:none;font-weight:700;
             padding:14px 32px;border-radius:12px;font-size:16px;display:inline-block">
      Registrarme gratis en FiestaGo →
    </a>
  </div>

  <p style="color:#8A7968;font-size:13px;line-height:1.6">
    ¿Tienes dudas? Escríbenos a
    <a href="mailto:${contactEmail}" style="color:#E8553E">${contactEmail}</a>
  </p>

  <hr style="border:none;border-top:1px solid #E4D9C6;margin:24px 0"/>
  <p style="color:#8A7968;font-size:12px">
    FiestaGo · El marketplace de celebraciones #1 en España<br/>
    <a href="https://fiestago.es" style="color:#8A7968">fiestago.es</a> ·
    <a href="mailto:${contactEmail}" style="color:#8A7968">${contactEmail}</a>
  </p>
</div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    `FiestaGo Partnerships <contacto@fiestago.es>`,
        to:      [provider.email],
        subject,
        text:    fullText,
        html:    htmlBody,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[OUTREACH] Error Resend:', data)
      return false
    }
    console.log(`[OUTREACH] Email enviado a ${provider.email} — ID: ${data.id}`)
    return true
  } catch (err) {
    console.error('[OUTREACH] Error:', err)
    return false
  }
}

// GET /api/admin/providers
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const category = searchParams.get('category')
  const city     = searchParams.get('city')
  const search   = searchParams.get('search')
  const limit    = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status)   query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (city)     query = query.eq('city', city)
  if (search)   query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ providers: data })
}

// PATCH /api/admin/providers
// Al aprobar → envía email de outreach y cambia estado a "contacted"
// El proveedor aparece en marketplace solo cuando se registra él mismo
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Si se intenta aprobar → enviar email y cambiar a "contacted" en vez de "approved"
  if (updates.status === 'approved') {
    const { data: provider } = await supabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .single()

    if (provider && !provider.outreach_sent) {
      const sent = await sendOutreachEmail(provider)
      if (sent) {
        // Cambiar a "contacted" — NO a "approved"
        // El proveedor aparecerá en el marketplace solo cuando se registre
        updates.status        = 'pending'  // sigue pendiente hasta que se registre
        updates.outreach_sent = true
        updates.outreach_at   = new Date().toISOString()
        updates.tag           = 'Contactado'
      }
    }
  }

  const { data, error } = await supabase
    .from('providers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ provider: data, emailSent: updates.outreach_sent || false })
}

// DELETE /api/admin/providers
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const { error } = await supabase.from('providers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
