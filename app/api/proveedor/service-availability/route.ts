import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { requireProviderAuth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/service-availability?service_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!serviceId) return NextResponse.json({ error: 'service_id requerido' }, { status: 400 })

  const { data: svc } = await supabase
    .from('provider_services').select('provider_id').eq('id', serviceId).maybeSingle()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  let q = supabase
    .from('service_availability')
    .select('*')
    .eq('service_id', serviceId)
    .order('blocked_date', { ascending: true })
  if (from) q = q.gte('blocked_date', from)
  if (to)   q = q.lte('blocked_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocked: data || [] })
}

// POST toggle (bloquear/desbloquear día)
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const { service_id, blocked_date, reason } = body || {}
  if (!service_id || !blocked_date) {
    return NextResponse.json({ error: 'service_id y blocked_date requeridos' }, { status: 400 })
  }

  const { data: svc } = await supabase
    .from('provider_services').select('provider_id').eq('id', service_id).maybeSingle()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  const { data: existing } = await supabase
    .from('service_availability')
    .select('id')
    .eq('service_id', service_id)
    .eq('blocked_date', blocked_date)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('service_availability').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ action: 'unblocked', blocked_date })
  }

  const { data, error } = await supabase
    .from('service_availability')
    .insert({ service_id, blocked_date, reason: reason || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'blocked', blocked: data })
}

// DELETE ?id=...
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { data: row } = await supabase
    .from('service_availability').select('service_id').eq('id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const { data: svc } = await supabase
    .from('provider_services').select('provider_id').eq('id', row.service_id).maybeSingle()
  if (!svc) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const auth = await requireProviderAuth(req, svc.provider_id)
  if (!auth.ok) return auth.response

  const { error } = await supabase.from('service_availability').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
