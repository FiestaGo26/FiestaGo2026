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
  const body    = lines.filter((l: string) => !l.startsWith('ASUNTO:')).join('\n').trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:  'FiestaGo Partnerships <contacto@fiestago.es>',,
        to:      [provider.email],
        subject,
        text:    body,
        html:    `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="margin-bottom:24px">
            <span style="font-size:24px">🎉</span>
            <strong style="font-size:18px;color:#1C1108"> FiestaGo</strong>
          </div>
          ${body.split('\n').map((line: string) =>
            line ? `<p style="color:#4A4A4A;line-height:1.6;margin:0 0 12px">${line}</p>` : '<br/>'
          ).join('')}
          <hr style="border:none;border-top:1px solid #E4D9C6;margin:24px 0"/>
          <p style="color:#8A7968;font-size:12px">
            FiestaGo · El marketplace de celebraciones #1 en España<br/>
            FiestaGo@outlook.es
          </p>
        </div>`,
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
// Al aprobar → envía email de outreach automáticamente via Resend
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  // Si se está aprobando → enviar email de outreach
  if (updates.status === 'approved') {
    const { data: provider } = await supabase
      .from('providers')
      .select('*')
      .eq('id', id)
      .single()

    if (provider && provider.outreach_email && !provider.outreach_sent) {
      const sent = await sendOutreachEmail(provider)
      if (sent) {
        updates.outreach_sent = true
        updates.outreach_at   = new Date().toISOString()
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
  return NextResponse.json({ provider: data })
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
