import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAuth(req: NextRequest) {
  return !!req.headers.get('x-provider-token')
}

// GET /api/proveedor/service-availability?service_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
// Lista los días BLOQUEADOS del servicio (en el rango opcional)
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const serviceId = searchParams.get('service_id')
  const from = searchParams.get('from')
  const to   = searchParams.get('to')
  if (!serviceId) return NextResponse.json({ error: 'service_id requerido' }, { status: 400 })

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

// POST /api/proveedor/service-availability
// body: { service_id, blocked_date, reason? }
// Toggle: si el día ya está bloqueado, lo desbloquea; si no, lo bloquea.
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const body = await req.json().catch(() => ({}))
  const { service_id, blocked_date, reason } = body || {}
  if (!service_id || !blocked_date) {
    return NextResponse.json({ error: 'service_id y blocked_date requeridos' }, { status: 400 })
  }

  // ¿Ya está bloqueado? → desbloquear
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

  // Si no, crear el bloqueo
  const { data, error } = await supabase
    .from('service_availability')
    .insert({ service_id, blocked_date, reason: reason || null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ action: 'blocked', blocked: data })
}

// DELETE /api/proveedor/service-availability?id=...
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const { error } = await supabase.from('service_availability').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
