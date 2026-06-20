import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'
import { QUICK_REPLY_DEFAULTS } from '@/lib/quick-reply-defaults'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/quick-replies?providerId=XXX
// Lista plantillas del proveedor. Si no tiene ninguna, siembra el
// pack por defecto y devuelve las recién creadas (zero-friction).
export async function GET(req: NextRequest) {
  const providerId = new URL(req.url).searchParams.get('providerId')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  const supabase = createAdminClient()

  const { data: existing, error } = await supabase
    .from('provider_quick_replies')
    .select('*')
    .eq('provider_id', providerId!)
    .order('category', { ascending: true })
    .order('label',    { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!existing || existing.length === 0) {
    const seeded = QUICK_REPLY_DEFAULTS.map(t => ({ ...t, provider_id: providerId }))
    const { data: inserted } = await supabase
      .from('provider_quick_replies').insert(seeded)
      .select('*')
      .order('category', { ascending: true })
      .order('label',    { ascending: true })
    return NextResponse.json({ templates: inserted || [], seeded: true })
  }

  return NextResponse.json({ templates: existing, seeded: false })
}

// POST  → crear (sin id) o actualizar (con id)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!body.label || !body.body) {
    return NextResponse.json({ error: 'label y body son obligatorios' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const payload = {
    provider_id: providerId,
    label:       String(body.label).slice(0, 80),
    body:        String(body.body).slice(0, 2000),
    category:    body.category || null,
    updated_at:  new Date().toISOString(),
  }
  if (body.id) {
    const { error } = await supabase.from('provider_quick_replies')
      .update(payload).eq('id', body.id).eq('provider_id', providerId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: body.id })
  } else {
    const { data, error } = await supabase.from('provider_quick_replies')
      .insert(payload).select('id').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data!.id })
  }
}

// DELETE /api/proveedor/quick-replies?providerId=X&id=Y
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const providerId = url.searchParams.get('providerId')
  const id         = url.searchParams.get('id')
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createAdminClient()
  const { error } = await supabase.from('provider_quick_replies')
    .delete().eq('id', id).eq('provider_id', providerId!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/proveedor/quick-replies — incrementa use_count
// (analytics simple: qué plantillas usa más el proveedor)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const providerId: string = body.providerId
  const auth = await requireProviderAuth(req, providerId)
  if (!auth.ok) return auth.response
  if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const supabase = createAdminClient()
  // Sin RPC: leemos + actualizamos. No es race-condition crítico (analytics).
  const { data } = await supabase.from('provider_quick_replies')
    .select('use_count').eq('id', body.id).eq('provider_id', providerId).single()
  if (data) {
    await supabase.from('provider_quick_replies')
      .update({ use_count: (data.use_count || 0) + 1 })
      .eq('id', body.id).eq('provider_id', providerId)
  }
  return NextResponse.json({ ok: true })
}
