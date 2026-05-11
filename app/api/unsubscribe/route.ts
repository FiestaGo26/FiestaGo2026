import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/unsubscribe
// body: { email: string, id?: string }
// También acepta GET con ?email=...&id=... para One-Click Unsubscribe (RFC 8058)
async function handle(req: NextRequest, body: any) {
  const email = (body?.email || '').toLowerCase().trim()
  const id    = body?.id || ''
  if (!email) return NextResponse.json({ ok: false, error: 'email requerido' }, { status: 400 })

  const supabase = createAdminClient()
  try {
    // 1) Marcar como unsubscribed en providers (para que el agente no lo vuelva a contactar)
    await supabase.from('providers')
      .update({ outreach_sent: true, status: 'rejected' })
      .ilike('email', email)

    // 2) Si pasaron id, marcar específicamente esa fila
    if (id) {
      await supabase.from('providers')
        .update({ outreach_sent: true })
        .eq('id', id)
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

// One-Click Unsubscribe lo manda Outlook/Gmail como POST sin JSON
export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || ''
  let body: any = {}
  if (ct.includes('application/json')) {
    body = await req.json().catch(() => ({}))
  } else {
    // form-data o url-encoded (One-Click)
    const form = await req.formData().catch(() => null)
    if (form) {
      const { searchParams } = new URL(req.url)
      body = {
        email: form.get('email') || searchParams.get('email'),
        id:    form.get('id')    || searchParams.get('id'),
      }
    } else {
      const { searchParams } = new URL(req.url)
      body = { email: searchParams.get('email'), id: searchParams.get('id') }
    }
  }
  return handle(req, body)
}

// GET para que clientes alternativos (mailto:?subject=unsubscribe) o tests funcionen
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  return handle(req, {
    email: searchParams.get('email'),
    id:    searchParams.get('id'),
  })
}
