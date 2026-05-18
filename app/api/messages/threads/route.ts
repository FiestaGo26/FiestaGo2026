import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/messages/threads?role=provider&token=<provider_id>
// GET /api/messages/threads?role=client&token=<client_email>
// Devuelve, por cada reserva confirmada/completada, último mensaje +
// número de no leídos para el rol que consulta.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const role  = searchParams.get('role') || ''
  const token = searchParams.get('token') || ''

  if (!role || !token) {
    return NextResponse.json({ error: 'role y token requeridos' }, { status: 400 })
  }

  let bookingsQ = supabase
    .from('bookings')
    .select('id, client_name, client_email, provider_id, event_date, status, providers(name, photo_url, photo_idx, category)')
    .in('status', ['confirmed', 'completed'])

  if (role === 'provider') {
    bookingsQ = bookingsQ.eq('provider_id', token)
  } else if (role === 'client') {
    bookingsQ = bookingsQ.eq('client_email', token)
  } else {
    return NextResponse.json({ error: 'role no válido' }, { status: 400 })
  }

  const { data: bookings, error } = await bookingsQ.order('event_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (bookings || []).map((b: any) => b.id)
  if (!ids.length) return NextResponse.json({ threads: [] })

  // Último mensaje y no leídos por reserva
  const { data: msgs } = await supabase
    .from('messages')
    .select('booking_id, sender_role, body, read_at, created_at')
    .in('booking_id', ids)
    .order('created_at', { ascending: false })

  const otherRole = role === 'client' ? 'provider' : 'client'
  const lastByBooking = new Map<string, any>()
  const unreadByBooking = new Map<string, number>()
  for (const m of (msgs || [])) {
    if (!lastByBooking.has(m.booking_id)) lastByBooking.set(m.booking_id, m)
    if (m.sender_role === otherRole && !m.read_at) {
      unreadByBooking.set(m.booking_id, (unreadByBooking.get(m.booking_id) || 0) + 1)
    }
  }

  const threads = (bookings || []).map((b: any) => ({
    booking_id:    b.id,
    client_name:   b.client_name,
    client_email:  b.client_email,
    provider_id:   b.provider_id,
    event_date:    b.event_date,
    status:        b.status,
    provider:      b.providers || null,
    last_message:  lastByBooking.get(b.id) || null,
    unread_count:  unreadByBooking.get(b.id) || 0,
  }))

  // Ordenar: los que tienen último mensaje primero (más reciente)
  threads.sort((a: any, b: any) => {
    const ta = a.last_message?.created_at || ''
    const tb = b.last_message?.created_at || ''
    return tb.localeCompare(ta)
  })

  return NextResponse.json({ threads })
}
