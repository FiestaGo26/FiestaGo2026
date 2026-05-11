import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function checkAdminAuth(req: NextRequest) {
  return req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD
}

// GET /api/admin/bookings?status=pending|confirmed|...|all&limit=100
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'all'
  const limit  = Math.min(parseInt(searchParams.get('limit') || '100'), 300)

  let q = supabase
    .from('bookings')
    .select(`*, providers(id, name, slug, category, city, email), packs(id, name, emoji, color)`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stats por status
  const { data: all } = await supabase.from('bookings').select('status')
  const stats: Record<string, number> = { total: all?.length || 0 }
  for (const b of (all || [])) stats[b.status] = (stats[b.status] || 0) + 1

  return NextResponse.json({ bookings: data || [], stats })
}

// PATCH /api/admin/bookings — admin puede cambiar status de cualquier reserva
export async function PATCH(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = createAdminClient()
  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id y status requeridos' }, { status: 400 })

  const updates: any = { status }
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

  // Lookup previous booking to know event_date / service_id en caso de cancelar
  const { data: prev } = await supabase.from('bookings').select('event_date, message').eq('id', id).single()

  const { data, error } = await supabase.from('bookings').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si cancela y conocemos la fecha, intentar liberar el bloqueo automático
  // (Solo desbloquea si el reason empieza por "Reservado por", para no
  //  borrar bloqueos puestos a mano por el proveedor)
  if (status === 'cancelled' && prev?.event_date) {
    try {
      await supabase.from('service_availability')
        .delete()
        .eq('blocked_date', prev.event_date)
        .like('reason', 'Reservado por%')
    } catch { /* no-op */ }
  }

  return NextResponse.json({ booking: data })
}
