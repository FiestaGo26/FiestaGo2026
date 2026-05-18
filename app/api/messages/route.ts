import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 2000

// Identifica que el llamante es realmente la parte que dice ser y devuelve
// la reserva ya cargada. Para cliente: sender_token = email del cliente.
// Para proveedor: sender_token = provider_id.
async function authorize(supabase: any, bookingId: string, role: string, token: string) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, client_email, provider_id, status')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return { error: 'Reserva no encontrada', status: 404 }
  if (!['confirmed', 'completed'].includes(booking.status)) {
    return { error: 'Solo se puede chatear sobre reservas confirmadas', status: 400 }
  }
  if (role === 'client') {
    if ((booking.client_email || '').toLowerCase() !== String(token).toLowerCase())
      return { error: 'No autorizado', status: 403 }
  } else if (role === 'provider') {
    if (booking.provider_id !== token) return { error: 'No autorizado', status: 403 }
  } else {
    return { error: 'Rol no válido', status: 400 }
  }
  return { booking }
}

// GET /api/messages?booking_id=...&role=client|provider&token=...
// Devuelve los mensajes del hilo y marca como leídos los del otro lado.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  const role      = searchParams.get('role') || ''
  const token     = searchParams.get('token') || ''

  if (!bookingId || !role || !token) {
    return NextResponse.json({ error: 'booking_id, role y token requeridos' }, { status: 400 })
  }

  const auth = await authorize(supabase, bookingId, role, token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, created_at, sender_role, body, read_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Marcar como leídos los del otro lado
  const otherRole = role === 'client' ? 'provider' : 'client'
  await supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('sender_role', otherRole)
    .is('read_at', null)

  return NextResponse.json({ messages: messages || [] })
}

// POST body: { booking_id, role, token, body }
export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const { booking_id, role, token, body } = await req.json().catch(() => ({}))

  if (!booking_id || !role || !token || !body) {
    return NextResponse.json({ error: 'booking_id, role, token y body requeridos' }, { status: 400 })
  }
  const text = String(body).trim()
  if (!text) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Máximo ${MAX_BODY} caracteres` }, { status: 400 })
  }

  const auth = await authorize(supabase, booking_id, role, token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await supabase
    .from('messages')
    .insert({
      booking_id,
      sender_role: role,
      body: text.slice(0, MAX_BODY),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
