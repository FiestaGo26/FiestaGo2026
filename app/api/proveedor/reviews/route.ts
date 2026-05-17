import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/proveedor/reviews?provider_id=...
// Lista todas las reseñas (con datos completos) de un proveedor para su panel.
export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(req.url)
  const providerId = searchParams.get('provider_id')

  if (!providerId) {
    return NextResponse.json({ error: 'provider_id requerido' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, client_name, event_type, event_date, review_rating, review_text, reviewed_at, review_reply, review_reply_at')
    .eq('provider_id', providerId)
    .not('review_rating', 'is', null)
    .order('reviewed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviews = (data || []).map((r: any) => ({
    id:          r.id,
    author:      (r.client_name || '').split(/\s+/)[0] || 'Cliente',
    rating:      r.review_rating,
    text:        r.review_text || '',
    event_type:  r.event_type || null,
    event_date:  r.event_date,
    date:        r.reviewed_at,
    reply:       r.review_reply || null,
    reply_date:  r.review_reply_at || null,
  }))

  return NextResponse.json({ reviews, total: reviews.length })
}

// PATCH /api/proveedor/reviews
// body: { booking_id, provider_id, reply }
// El proveedor responde a una reseña. Solo puede responder a reseñas de sus
// propias reservas. Reply vacío/null borra la respuesta.
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient()
  const { booking_id, provider_id, reply } = await req.json().catch(() => ({}))

  if (!booking_id || !provider_id) {
    return NextResponse.json({ error: 'booking_id y provider_id requeridos' }, { status: 400 })
  }

  const { data: booking, error: getErr } = await supabase
    .from('bookings')
    .select('id, provider_id, review_rating')
    .eq('id', booking_id)
    .maybeSingle()

  if (getErr)   return NextResponse.json({ error: getErr.message },     { status: 500 })
  if (!booking) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  if (booking.provider_id !== provider_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (booking.review_rating == null) {
    return NextResponse.json({ error: 'Esta reserva aún no tiene reseña' }, { status: 400 })
  }

  const cleanReply = typeof reply === 'string' && reply.trim()
    ? reply.trim().slice(0, 1000)
    : null

  const { data, error } = await supabase
    .from('bookings')
    .update({
      review_reply:    cleanReply,
      review_reply_at: cleanReply ? new Date().toISOString() : null,
    })
    .eq('id', booking_id)
    .select('id, review_reply, review_reply_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ booking: data })
}
