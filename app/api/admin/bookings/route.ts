import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { emailClientBookingConfirmed, emailClientBookingCancelled } from '@/lib/resend'
import { calcRefund } from '@/lib/constants'
import { exportBookingToGoogle, removeBookingFromGoogle } from '@/lib/google-sync'

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

  // Lookup previa: fecha + total + política del servicio para refund
  const { data: prev } = await supabase
    .from('bookings')
    .select('event_date, message, total_amount, service_id, provider_services(cancellation_policy)')
    .eq('id', id).single()

  let refund: { percent: number; amount: number; rule: string } | null = null
  if (status === 'cancelled' && prev) {
    refund = calcRefund({
      policy: (prev as any).provider_services?.cancellation_policy,
      eventDate: prev.event_date,
      totalAmount: prev.total_amount || 0,
    })
    updates.refund_percent = refund.percent
    updates.refund_amount  = refund.amount
  }

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

  // Email al cliente avisando del cambio
  if (status === 'confirmed' || status === 'cancelled') {
    try {
      if (data.provider_id) {
        const { data: prov } = await supabase
          .from('providers').select('id, name, email, phone')
          .eq('id', data.provider_id).single()
        if (prov) {
          if (status === 'confirmed') {
            emailClientBookingConfirmed(data, prov).catch(err =>
              console.error('emailClientBookingConfirmed:', err?.message))
          } else {
            emailClientBookingCancelled(data, prov, 'admin', undefined, refund).catch(err =>
              console.error('emailClientBookingCancelled:', err?.message))
          }
        }
      }
    } catch { /* no-op */ }
  }

  // Google Calendar sync: si está conectado, exportar/borrar el evento.
  if (status === 'confirmed') {
    exportBookingToGoogle(id).catch(err => console.error('gcal export:', err?.message))
  } else if (status === 'cancelled') {
    removeBookingFromGoogle(id).catch(err => console.error('gcal remove:', err?.message))
  }

  return NextResponse.json({ booking: data })
}
