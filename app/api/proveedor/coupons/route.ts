import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalize(code: string) {
  return (code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
}

// GET ?provider_id=...
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('provider_id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('provider_id', providerId!)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupons: data || [] })
}

// POST body: { provider_id, code, description?, percent_off, max_uses?, expires_at? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const auth = await requireProviderAuth(req, body.provider_id)
  if (!auth.ok) return auth.response

  const code = normalize(body.code)
  const percent = parseInt(body.percent_off)
  if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    return NextResponse.json({ error: 'percent_off entre 1 y 100' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('coupons')
    .insert({
      provider_id:  body.provider_id,
      code,
      description:  body.description || null,
      percent_off:  percent,
      max_uses:     body.max_uses ? parseInt(body.max_uses) : null,
      expires_at:   body.expires_at || null,
      active:       true,
    })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya tienes un cupón con ese código' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon: data }, { status: 201 })
}

// PATCH body: { id, provider_id, ...updates(active|description|percent_off|max_uses|expires_at) }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, provider_id, ...rawUpdates } = body
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const auth = await requireProviderAuth(req, provider_id)
  if (!auth.ok) return auth.response

  const allowed = ['active', 'description', 'percent_off', 'max_uses', 'expires_at']
  const updates: Record<string, any> = {}
  for (const k of allowed) {
    if (k in rawUpdates) updates[k] = rawUpdates[k]
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('coupons').update(updates)
    .eq('id', id).eq('provider_id', provider_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupon: data })
}

// DELETE ?id=...&provider_id=...
export async function DELETE(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const id = sp.get('id'); const provider_id = sp.get('provider_id')
  if (!id || !provider_id) return NextResponse.json({ error: 'id y provider_id requeridos' }, { status: 400 })
  const auth = await requireProviderAuth(req, provider_id)
  if (!auth.ok) return auth.response

  const supabase = createAdminClient()
  const { error } = await supabase.from('coupons').delete().eq('id', id).eq('provider_id', provider_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
